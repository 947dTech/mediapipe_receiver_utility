#[cfg_attr(mobile, tauri::mobile_entry_point)]

use std::cell::RefCell;
use std::fs::File;
use std::io::prelude::*;
use std::io::{self, BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use tokio::fs::File as AsyncFile;
use tokio::io::{self as async_io, AsyncWriteExt};
use tokio::net::UdpSocket;
use tokio::sync::mpsc::unbounded_channel;
use tokio_util::codec::{Decoder, LinesCodec};
use tokio_util::udp::UdpFramed;
// use futures::prelude::*;  // split()はこれを使わないと成功しない
use futures_util::StreamExt;

use tauri::{
    Emitter,
    Listener,
    Manager,
    State,
    WindowEvent,
};

use tauri::menu::{
    MenuBuilder,
    MenuItemBuilder,
    PredefinedMenuItem,
    SubmenuBuilder,
};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::FilePath;

// 複数行にわたるJSONを格納するための構造体
struct TrackingFrame {
    json_str: String,
    timestamp: u64,
}

impl TrackingFrame {
    fn new(json_str: String) -> Self {
        Self {
            json_str: json_str,
            timestamp: 0,
        }
    }

    // JSONからpose_landmarks_stampを取り出してtimestampに追加する
    fn extract_timestamp(&mut self) {
        let v: serde_json::Value = serde_json::from_str(&self.json_str).unwrap();
        let timestamp = v["pose_landmarks_stamp"].as_u64().unwrap();
        self.timestamp = timestamp;
    }
}

// TrackingFrameのVecを格納するための構造体
#[derive(Default)]
struct TrackingFrames(Mutex<Vec<TrackingFrame>>);

// カウンタ
#[derive(Default)]
struct Counter(Arc<Mutex<usize>>);

// 現在スレッドが実行されているかどうか
#[derive(Default)]
struct RunningStatus(Arc<Mutex<bool>>);

// event用のPayload
#[derive(Clone, serde::Serialize)]
struct Payload {
    filetext: String,
    current_frame: usize,
    current_stamp: u64,
}

// 読み込んだファイルの概要を通知するためのPayload
#[derive(Clone, serde::Serialize)]
struct FrameNotifyPayload {
    current_frame: usize,
    total_frames: usize,
    begin_timestamp: u64,
    end_timestamp: u64,
}

// UDPソケットでの待ち受け、明示的にinvokeで開始。
// 明示的にeventで終了。
// 以下の投稿を参考にしている。
// https://github.com/tokio-rs/tokio/discussions/4533
async fn receive_udp(
    app_handle: &tauri::AppHandle,
    window: &tauri::Window,
    framed: UdpFramed<LinesCodec>,
) {
    framed
        .for_each(|msg| async {
            // println!("receiver: received.");
            let (msg_str, _addr) = msg.unwrap();
            window.emit(
                "udp_receive",
                Payload {
                    filetext: msg_str,
                    current_frame: 0,
                    current_stamp: 0,
                },
            );
        })
        .await;
}

#[tauri::command]
async fn start_receive(app_handle: tauri::AppHandle, window: tauri::Window) {
    println!("receiver: called");
    match UdpSocket::bind("0.0.0.0:38013").await {
        Ok(sock) => {
            println!("receiver: start");
            let framed = UdpFramed::new(sock, LinesCodec::new());
            // let (_tx, rx) = framed.split();  // cannot infer type for type parameter `T`

            let (send, mut recv) = unbounded_channel();

            let stop_id = app_handle.listen_any("udp_stop", move |event| {
                println!("receiver: stop");
                send.send(());
            });

            tokio::select! {
              _ = receive_udp(&app_handle, &window, framed) => {},
              _ = recv.recv() => {},
            }

            app_handle.unlisten(stop_id); // recv.recv()が終わってからunlisten

            // 以下のコードはstack overflowでうごかない
            // let mut buf = [0; 65536];
            // loop {
            //   println!("receiver: waiting packet");
            //   match sock.recv_from(&mut buf).await{
            //     Ok((len, addr)) => {
            //       println!("{:?} bytes received from {:?}", len, addr);
            //       let sbuf = &buf[0..len];
            //       let json_str = String::from_utf8(sbuf.to_vec()).unwrap();
            //     },
            //     Err(err) => {}
            //   }
            // }
        }
        Err(err) => {
            println!("receiver: already running?");
        }
    }
}

// 受け取ったUDPパケットをファイルに保存しながら送信する。
async fn record_udp(
    app_handle: &tauri::AppHandle,
    window: &tauri::Window,
    mut framed: UdpFramed<LinesCodec>,
    path: &PathBuf,
) {
    match AsyncFile::create(&path).await {
        Err(why) => panic!("{}", why),
        Ok(mut file) => {
            // NOTE: for_eachを使うとfileを渡せなくなるのでwhileにしている
            while let Some(msg) = framed.next().await {
                let (msg_str, _addr) = msg.unwrap();
                window.emit(
                    "udp_receive",
                    Payload {
                        filetext: msg_str.clone(),
                        current_frame: 0,
                        current_stamp: 0,
                    },
                );
                // msg_strの最後に改行を追加して書き込む
                let msg_str_ln = format!("{}\n", msg_str);
                file.write_all(msg_str_ln.as_bytes()).await.unwrap();
            }
        }
    }
}

#[tauri::command]
async fn start_record(app_handle: tauri::AppHandle, window: tauri::Window) {
    println!("recorder: called");
    // まずダイアログを開いてファイルを指定する。
    let mut file_path = app_handle.dialog().file().blocking_save_file();
    match file_path {
        Some(path) => {
            // UDP待ち受け開始
            match UdpSocket::bind("0.0.0.0:38013").await {
                Ok(sock) => {
                    println!("recorder: start");
                    let framed = UdpFramed::new(sock, LinesCodec::new());

                    let (send, mut recv) = unbounded_channel();

                    let stop_id = app_handle.listen_any("udp_stop", move |event| {
                        println!("recorder: stop");
                        send.send(());
                    });

                    let pathbuf = path.into_path().unwrap().to_path_buf();

                    tokio::select! {
                    _ = record_udp(&app_handle, &window, framed, &pathbuf) => {},
                    _ = recv.recv() => {},
                    }

                    app_handle.unlisten(stop_id); // recv.recv()が終わってからunlisten
                }
                Err(err) => {
                    println!("recorder: already running?");
                }
            }
        }
        _ => {
            println!("recorder: invalid file path?");
        }
    }
}

// 中身が空なのは、eventがバックエンド内部では送受信できない。
// なので、フロントエンドからeventを送信して、
// udp_stopを呼び出す。
#[tauri::command]
async fn end_receive() {}

// UDPと同様にjson文字列をemitする無限ループを作成する。
async fn send_json(
    app_handle: &tauri::AppHandle,
    window: &tauri::Window,
    sock: UdpSocket,
    tracking_frames: &State<'_, TrackingFrames>,
    counter: &State<'_, Counter>,
) {
    let tf_buf = tracking_frames.0.lock().await;
    let idx = *counter.0.lock().await;
    if idx >= tf_buf.len() {
        println!("  send_json: idx is out of range.");
    } else {
        // 長時間のデータの場合、誤差が累積しないように
        // 送信開始時のタイムスタンプと現在のタイムスタンプの差分が
        // 送信開始時の時刻と現在の時刻の差分と同じになるようにする。
        let timeline_origin: u64 = tf_buf[idx].timestamp;
        let stream_origin = Instant::now();
        // 前回送信直後の時刻を保持する。
        let mut timestamp_prev = stream_origin;

        let mut t0: u64 = tf_buf[idx].timestamp;
        // for tf in tf_buf.iter() {
        for i in idx..tf_buf.len() {
            let tf = &tf_buf[i];
            let t1: u64 = tf.timestamp;
            if t1 < t0 {
                // この場合タイムラインが壊れているので送信しない。
                println!("  send_json: time diff is negative.");
                t0 = t1;
            } else {
                t0 = t1;
                // タイムスタンプにおける現在フレームと始点との差分(1)
                let td_from_origin = t1 - timeline_origin;
                // 前回送信時刻と最初に送信した時刻の差分(2)
                let duration_from_origin = timestamp_prev - stream_origin;
                // 待機時間は(1)-(2)
                let td_from_prev = td_from_origin - (duration_from_origin.as_micros() as u64);
                tokio::time::sleep(Duration::from_micros(td_from_prev)).await;
                println!(
                    "  send_json: in the loop, waited {} microsec.",
                    td_from_prev
                );
                // 送信前のタイムスタンプを保持する
                let duration0 = Instant::now();
                // フロントエンドに送信
                window.emit(
                    "json_send",
                    Payload {
                        filetext: tf.json_str.clone(),
                        current_frame: i,
                        current_stamp: tf.timestamp,
                    },
                );
                // UDPで送信
                sock.send(tf.json_str.clone().as_bytes()).await;
                // 送信にかかった時間を計算
                let duration1 = Instant::now();
                let duration = duration1 - duration0;
                println!(
                    "  send_json: emit duration: {} microsec.",
                    duration.as_micros()
                );
                // 送信にかかった時間は加算せず、今回送信を開始した時刻を保存しておく。
                timestamp_prev = duration0;
            }
            // *counter.0.lock().await += 1;
            *counter.0.lock().await = i + 1; // 他のスレッドから書き換えられる可能性を考えるとi+1
            println!("  send_json: counter: {}", *counter.0.lock().await);
        }
        println!("  send_json: loop end.");
    }
}

// 再生スレッドを実行する。
#[tauri::command]
async fn start_json(
    counter_reset: bool,
    ipaddr: String,
    app_handle: tauri::AppHandle,
    window: tauri::Window,
    tracking_frames: State<'_, TrackingFrames>,
    counter: State<'_, Counter>,
    running: State<'_, RunningStatus>,
) -> Result<(), ()> {
    println!("start_json: called");
    if *running.0.lock().await {
        println!("start_json: already running.");
        return Err(());
    }
    *running.0.lock().await = true;

    // counterを初期化
    if counter_reset {
        *counter.0.lock().await = 0;
    }

    // bindでは0.0.0.0を指定しておく。
    match UdpSocket::bind("0.0.0.0:0").await {
        Ok(sock) => {
            // 送信だけが必要なのでconnectで送信先を指定する。
            sock.connect(format!("{}:38013", ipaddr)).await;

            // UDPと同様に、unbounded_channelを使って送信スレッドを作成。
            let (send, mut recv) = unbounded_channel();

            let stop_id = app_handle.listen_any("json_stop", move |event| {
                println!("receiver: stop");
                send.send(());
            });

            tokio::select! {
              _ = send_json(
                &app_handle, &window, sock, &tracking_frames, &counter) => {},
              _ = recv.recv() => {},
            }
            println!("open_file: end");
            println!("open_file: counter: {}", *counter.0.lock().await);

            app_handle.unlisten(stop_id); // recv.recv()が終わってからunlisten
        }
        Err(err) => {
            println!("start_json: binding failed.");
        }
    }

    *running.0.lock().await = false;
    println!("start_json: end");

    Ok(())
}

// ステップ実行を行う。
#[tauri::command]
async fn step_json(
    counter_reset: bool,
    increment: bool,
    app_handle: tauri::AppHandle,
    window: tauri::Window,
    tracking_frames: State<'_, TrackingFrames>,
    counter: State<'_, Counter>,
    running: State<'_, RunningStatus>,
) -> Result<(), ()> {
    println!("step_json: called");
    if *running.0.lock().await {
        println!("step_json: already running.");
        return Err(());
    }
    *running.0.lock().await = true;

    let tf_buf = tracking_frames.0.lock().await;
    let buf_length = tf_buf.len();

    if buf_length > 1 {
        let cnt = *counter.0.lock().await;
        // cntには次のフレームのインデックスが入っている。
        // incrementがtrueなら、cntをそのまま使う。
        // incrementがfalseなら、cntを2減らす。
        let mut idx: usize;
        if increment {
            idx = cnt % buf_length;
            *counter.0.lock().await = (cnt + 1) % buf_length;
        } else {
            idx = (buf_length + cnt - 2) % buf_length;
            *counter.0.lock().await = (buf_length + cnt - 1) % buf_length;
        }
        let tf = &tf_buf[idx];
        window.emit(
            "json_send",
            Payload {
                filetext: tf.json_str.clone(),
                current_frame: idx,
                current_stamp: tf.timestamp,
            },
        );
    }

    *running.0.lock().await = false;
    println!("step_json: end");

    Ok(())
}

// counterを任意の位置に設定する。
#[tauri::command]
async fn set_counter(
    idx: usize,
    app_handle: tauri::AppHandle,
    window: tauri::Window,
    tracking_frames: State<'_, TrackingFrames>,
    counter: State<'_, Counter>,
    running: State<'_, RunningStatus>,
) -> Result<(), ()> {
    println!("set_counter: called");
    if *running.0.lock().await {
        println!("set_counter: already running.");
        return Err(());
    }
    *running.0.lock().await = true;

    let tf_buf = tracking_frames.0.lock().await;
    let buf_length = tf_buf.len();

    if idx < buf_length {
        // cntには次のフレームのインデックスが入る。
        *counter.0.lock().await = (idx + 1) % buf_length;
        let tf = &tf_buf[idx];
        window.emit(
            "json_send",
            Payload {
                filetext: tf.json_str.clone(),
                current_frame: idx,
                current_stamp: tf.timestamp,
            },
        );
    }

    *running.0.lock().await = false;
    println!("set_counter: end");

    Ok(())
}

// メニューからファイルダイアログを開き、
// 指定されたファイルをテキストで開いて、一行ずつ読み込む。
// 読み込んだ内容をフロントエンドにeventで送る。
// ファイルの開き方？
// 小さいファイルであれば一度メモリにためてしまう。
// 大きいファイルであれば、
// 開きっぱなしにして任意の行を送信できるようにする。
#[tauri::command]
async fn open_file(
    app_handle: tauri::AppHandle,
    window: tauri::Window,
    tracking_frames: State<'_, TrackingFrames>,
    counter: State<'_, Counter>,
    running: State<'_, RunningStatus>,
) -> Result<(), ()> {
    println!("open_file invoked");
    let mut file_path = app_handle.dialog().file().blocking_pick_file();

    match file_path {
        Some(path) => {
            let pathbuf = path.into_path().unwrap().to_path_buf();

            let mut file = match File::open(&pathbuf) {
                Err(why) => panic!("{}", why),
                Ok(file) => file,
            };

            // ファイルの中身を一行ずつ読み込んでTrackingFrameを作成し、
            // TrackingFramesに格納する。
            for line in BufReader::new(file).lines() {
                match line {
                    Ok(s) => {
                        let mut tf = TrackingFrame::new(s);
                        tf.extract_timestamp();
                        println!("stamp: {}", tf.timestamp);
                        tracking_frames.0.lock().await.push(tf);
                    }
                    _ => {}
                }
            }

            // フロントエンドに読み込んだファイルの行数を送信する。
            let tf_buf = tracking_frames.0.lock().await;
            let total_frames = tf_buf.len();
            window.emit(
                "total_frames",
                FrameNotifyPayload {
                    current_frame: 0,
                    total_frames: total_frames,
                    begin_timestamp: tf_buf[0].timestamp,
                    end_timestamp: tf_buf[total_frames - 1].timestamp,
                },
            );
        }
        _ => {}
    }

    // counterを初期化
    *counter.0.lock().await = 0;

    Ok(())
}

// ファイルを保存する場合は、
// メニューからダイアログを開き、
// ファイル名を指定してeventでフロントエンドに送信、
// フロントエンドからはinvokeで保存コマンドを呼び出す。
#[tauri::command]
async fn save_file(app_handle: tauri::AppHandle, window: tauri::Window) {
    let mut file_path = app_handle.dialog().file().blocking_pick_file();

    match file_path {
        Some(path) => {
            let pathbuf = path.into_path().unwrap().to_path_buf();
            match pathbuf.to_str() {
                Some(s) => {
                    window.emit(
                        "save_file",
                        Payload {
                            filetext: s.to_string(),
                            current_frame: 0,
                            current_stamp: 0,
                        },
                    );
                }
                _ => {}
            }
        }
        _ => {}
    }
}

pub fn run() {
    let context = tauri::generate_context!();

    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(TrackingFrames(Default::default()))
        .manage(Counter(Default::default()))
        .manage(RunningStatus(Default::default()))
        .invoke_handler(tauri::generate_handler![
            start_receive,
            start_record,
            end_receive,
            open_file,
            save_file,
            start_json,
            step_json,
            set_counter
        ])
        .setup(|app| {
            let m_open = MenuItemBuilder::with_id("open", "Open").build(app)?;
            let m_save = MenuItemBuilder::with_id("save", "Save").build(app)?;
            let submenu = SubmenuBuilder::new(app, "File").items(&[&m_open, &m_save]).build()?;
            let menu = MenuBuilder::new(app).item(&submenu).build()?;
            app.set_menu(menu);
            app.on_menu_event(|app, event| match event.id().as_ref() {
                "open" => {
                    println!("open menu called");
                    app.emit(
                        "open_menu",
                        Payload {
                            filetext: "".to_string(),
                            current_frame: 0,
                            current_stamp: 0,
                        },
                    );
                }
                "save" => {
                    println!("save menu called");
                    app.emit(
                        "save_menu",
                        Payload {
                            filetext: "".to_string(),
                            current_frame: 0,
                            current_stamp: 0,
                        },
                    );
                }
                _ => {}
            });

            Ok(())
        })
        .run(context)
        .expect("error while running tauri application");
}
