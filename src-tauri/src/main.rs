#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use std::fs::File;
use std::io::prelude::*;
use std::path::Path;

use tokio::net::UdpSocket;
use tokio_util::udp::UdpFramed;
use tokio_util::codec::LinesCodec;
use tokio::sync::mpsc::unbounded_channel;
// use futures::prelude::*;  // split()はこれを使わないと成功しない
use futures_util::StreamExt;

use tauri::{CustomMenuItem, Menu, MenuItem, Submenu,
  WindowEvent,
  Manager,
  // api::dialog::FileDialogBuilder,
  api::dialog::blocking::FileDialogBuilder,
};


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

// TODO: recordを開始するコマンドを作る。
// receiveとrecordは排他的に動くようにし、
// 保存するファイル名はあらかじめ指定しておく。
#[tauri::command]
async fn start_record(
  app_handle: tauri::AppHandle, window: tauri::Window
) {
}


// 中身が空なのは、eventがバックエンド内部では送受信できない。
// なので、フロントエンドからeventを送信して、
// udp_stopを呼び出す。
#[tauri::command]
async fn end_receive() {

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
  app_handle: tauri::AppHandle, window: tauri::Window
) {
  println!("open_file invoked");
  let file_path = FileDialogBuilder::new().pick_file();
  match file_path {
    Some(path) => {
      let mut file = match File::open(&path) {
        Err(why) => panic!("{}", why),
        Ok(file) => file,
      };

      let mut filetext = String::new();
      match file.read_to_string(&mut filetext) {
        Err(why) => panic!("{}", why),
        Ok(_) => (),
      };
      window.emit("open_file", Payload {
        filetext: filetext
      });
    }
    _ => {}
  }
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
    .invoke_handler(
      tauri::generate_handler![
        start_receive, end_receive, open_file, save_file
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
