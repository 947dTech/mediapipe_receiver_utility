#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use std::fs::File;
use std::io::{
  self, BufRead, BufReader, Write
};
use std::time::{
  Duration, Instant
};
use std::io::prelude::*;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;

use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use tokio::fs::File as AsyncFile;
use tokio::io::{self as async_io, AsyncWriteExt};
use tokio::net::UdpSocket;
use tokio_util::udp::UdpFramed;
use tokio_util::codec::{LinesCodec, Decoder};
use tokio::sync::mpsc::unbounded_channel;
// use futures::prelude::*;  // split()はこれを使わないと成功しない
use futures_util::StreamExt;

use tauri::{CustomMenuItem, Menu, MenuItem, Submenu,
  WindowEvent,
  Manager,
  State,
  // api::dialog::FileDialogBuilder,
  api::dialog::blocking::FileDialogBuilder,
};

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
}

// UDPソケットでの待ち受け、明示的にinvokeで開始。
// 明示的にeventで終了。
// 以下の投稿を参考にしている。
// https://github.com/tokio-rs/tokio/discussions/4533
async fn receive_udp(
  app_handle: &tauri::AppHandle,
  window: &tauri::Window,
  framed: UdpFramed<LinesCodec>
) {
  framed.for_each(|msg| async {
    // println!("receiver: received.");
    let (msg_str, _addr) = msg.unwrap();
    window.emit("udp_receive", Payload {
      filetext: msg_str
    });
  }).await;
}

#[tauri::command]
async fn start_receive(
  app_handle: tauri::AppHandle, window: tauri::Window
) {
  println!("receiver: called");
  match UdpSocket::bind("0.0.0.0:38013").await{
    Ok(sock) => {
      println!("receiver: start");
      let framed = UdpFramed::new(sock, LinesCodec::new());
      // let (_tx, rx) = framed.split();  // cannot infer type for type parameter `T`

      let (send, mut recv) = unbounded_channel();

      let stop_id = app_handle.listen_global("udp_stop", move |event| {
        println!("receiver: stop");
        send.send(());
      });

      tokio::select! {
        _ = receive_udp(&app_handle, &window, framed) => {},
        _ = recv.recv() => {},
      }

      app_handle.unlisten(stop_id);  // recv.recv()が終わってからunlisten

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
    },
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
  path: &PathBuf
) {
  match AsyncFile::create(&path).await {
    Err(why) => panic!("{}", why),
    Ok(mut file) => {
      // NOTE: for_eachを使うとfileを渡せなくなるのでwhileにしている
      while let Some(msg) = framed.next().await {
        let (msg_str, _addr) = msg.unwrap();
        window.emit("udp_receive", Payload {
          filetext: msg_str.clone()
        });
        // msg_strの最後に改行を追加して書き込む
        let msg_str_ln = format!("{}\n", msg_str);
        file.write_all(msg_str_ln.as_bytes()).await.unwrap();
      }
    }
  }
}

#[tauri::command]
async fn start_record(
  app_handle: tauri::AppHandle, window: tauri::Window
) {
  println!("recorder: called");
  // まずダイアログを開いてファイルを指定する。
  let file_path = FileDialogBuilder::new().save_file();
  match file_path {
    Some(path) => {
      // UDP待ち受け開始
      match UdpSocket::bind("0.0.0.0:38013").await{
        Ok(sock) => {
          println!("recorder: start");
          let framed = UdpFramed::new(sock, LinesCodec::new());

          let (send, mut recv) = unbounded_channel();

          let stop_id = app_handle.listen_global("udp_stop", move |event| {
            println!("recorder: stop");
            send.send(());
          });

          tokio::select! {
            _ = record_udp(&app_handle, &window, framed, &path) => {},
            _ = recv.recv() => {},
          }

          app_handle.unlisten(stop_id);  // recv.recv()が終わってからunlisten
        },
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
async fn end_receive() {

}


// UDPと同様にjson文字列をemitする無限ループを作成する。
async fn send_json(
  app_handle: &tauri::AppHandle,
  window: &tauri::Window,
  tracking_frames: &State<'_, TrackingFrames>,
  counter: &State<'_, Counter>
) {
  let tf_buf = tracking_frames.0.lock().await;
  let idx = *counter.0.lock().await;
  if idx >= tf_buf.len() {
    println!("  send_json: idx is out of range.");
  } else {
    let mut t0: u64 = tf_buf[idx].timestamp;
    // for tf in tf_buf.iter() {
    for i in idx..tf_buf.len() {
      let tf = &tf_buf[i];
      let t1: u64 = tf.timestamp;
      if t1 < t0 {
        println!("  send_json: time diff is negative.");
        t0 = t1;
      } else {
        let td = t1 - t0;
        t0 = t1;
        tokio::time::sleep(Duration::from_micros(td)).await;
        println!("  send_json: in the loop, waited {} microsec.", td);
        let duration0 = Instant::now();
        window.emit("json_send", Payload {
          filetext: tf.json_str.clone()
        });
        let duration1 = Instant::now();
        let duration = duration1 - duration0;
        println!("  send_json: emit duration: {} microsec.", duration.as_micros());
        t0 += duration.as_micros() as u64;
      }
      // *counter.0.lock().await += 1;
      *counter.0.lock().await = i + 1;  // 他のスレッドから書き換えられる可能性を考えるとi+1
      println!("  send_json: counter: {}", *counter.0.lock().await);
    }
    println!("  send_json: loop end.");
  }
}

// 再生スレッドを実行する。
#[tauri::command]
async fn start_json(
  counter_reset: bool,
  app_handle: tauri::AppHandle,
  window: tauri::Window,
  tracking_frames: State<'_, TrackingFrames>,
  counter: State<'_, Counter>,
  running: State<'_, RunningStatus>
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

  // UDPと同様に、unbounded_channelを使って送信スレッドを作成。
  let (send, mut recv) = unbounded_channel();

  let stop_id = app_handle.listen_global("json_stop", move |event| {
    println!("receiver: stop");
    send.send(());
  });

  tokio::select! {
    _ = send_json(&app_handle, &window, &tracking_frames, &counter) => {},
    _ = recv.recv() => {},
  }
  println!("open_file: end");
  println!("open_file: counter: {}", *counter.0.lock().await);

  app_handle.unlisten(stop_id);  // recv.recv()が終わってからunlisten

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
  running: State<'_, RunningStatus>
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
    let mut idx : usize;
    if increment {
      idx = cnt % buf_length;
      *counter.0.lock().await =
        (cnt + 1) % buf_length;
    } else {
      idx = (buf_length + cnt - 2) % buf_length;
      *counter.0.lock().await =
        (buf_length + cnt - 1) % buf_length;
    }
    let tf = &tf_buf[idx];
    window.emit("json_send", Payload {
      filetext: tf.json_str.clone()
    });
  }

  *running.0.lock().await = false;
  println!("step_json: end");

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
  running: State<'_, RunningStatus>
)  -> Result<(), ()>  {
  println!("open_file invoked");
  let file_path = FileDialogBuilder::new().pick_file();
  match file_path {
    Some(path) => {
      let mut file = match File::open(&path) {
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
async fn save_file(
  app_handle: tauri::AppHandle, window: tauri::Window
) {
  let file_path = FileDialogBuilder::new().pick_file();
  match file_path {
    Some(path) => {
      match path.to_str() {
        Some(s) => {
          window.emit("save_file", Payload {
            filetext: s.to_string()
          });
        }
        _ => {}
      }
    }
    _ => {}
  }
}


fn main() {
  let context = tauri::generate_context!();

  let m_open = CustomMenuItem::new("open".to_string(), "Open");
  let m_save = CustomMenuItem::new("save".to_string(), "Save");
  let submenu =
    Submenu::new("File", Menu::new()
    .add_item(m_open)
    .add_item(m_save));
  let menu = Menu::new().add_submenu(submenu);

  tauri::Builder::default()
    .manage(TrackingFrames(Default::default()))
    .manage(Counter(Default::default()))
    .manage(RunningStatus(Default::default()))
    .invoke_handler(
      tauri::generate_handler![
        start_receive,
        start_record,
        end_receive,
        open_file,
        save_file,
        start_json,
        step_json
      ]
    )
    // .menu(tauri::Menu::os_default(&context.package_info().name))
    .menu(menu)
    .on_menu_event(|event| {
      match event.menu_item_id() {
        "open" => {
          println!("open menu called");
          let window = event.window();
          window.emit("open_menu", Payload {
            filetext: "".to_string()
          });
        }
        "save" => {
          println!("save menu called");
          let window = event.window();
          window.emit("save_menu", Payload {
            filetext: "".to_string()
          });
        }
        _ => {}
      }
    })
    .run(context)
    .expect("error while running tauri application");
}
