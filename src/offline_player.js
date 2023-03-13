import * as THREE from "three";
import { OrbitControls } from "@three-ts/orbit-controls";
import { AmbientLight, HemisphereLight } from "three";

import {invoke} from "@tauri-apps/api/tauri";
import {listen, emit} from "@tauri-apps/api/event";
import {appWindow} from "@tauri-apps/api/window";

import {MediapipeHolisticResult} from "./viewer";

const play_button = document.getElementById("play_anim");
const pause_button = document.getElementById("pause_anim");
const stop_button = document.getElementById("stop_anim");
const next_button = document.getElementById("next_frame");
const prev_button = document.getElementById("prev_frame");
const message_div = document.getElementById("message_div");


const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75, window.innerWidth / window.innerHeight, 0.001, 100.0);
camera.position.z = -2;
camera.lookAt(0, 0, 0);

// const canvas = document.getElementById("canvas");
// const renderer = new THREE.WebGLRenderer({canvas: canvas});

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth * 0.8, window.innerHeight * 0.8);
renderer.setClearColor(0xcccccc, 1);
const three_view = document.getElementById("three_view");
// document.body.appendChild(renderer.domElement);
three_view.appendChild(renderer.domElement);

const controls = new OrbitControls(
    camera, renderer.domElement);

const light = new HemisphereLight(0xffffbb, 0x080820 ,1);
scene.add(light);

var json_strings = null;
var json_data_frames = 0;
var json_data_current_frame = 0;
var json_data_stamps = [];
var playing = false;

var holistic_result = new MediapipeHolisticResult(scene, message_div);

// eventで送信されてきた文字列をjsonにする。
// jsonをパースして表示する。
const unlisten_open_file = listen("open_file", event => {
    json_strings = event.payload.filetext.split("\n");

    // TODO: タイムスタンプが書かれているので、
    // jsonを一度解釈してタイムスタンプを全部書き出す。

    json_data_stamps = []
    let stamp = 0;

    json_strings.forEach(json_string => {
        try {
            // let msg = JSON.parse(json_strings[0]);
            let msg = JSON.parse(json_string);

            if ("pose_landmarks_stamp" in msg) {
                stamp = msg["pose_landmarks_stamp"];
            }
        } catch(e) {
            console.error(e);
        }

        json_data_stamps.push(stamp);
    });

    json_data_frames = json_strings.length;
    json_data_current_frame = 0;

    // draw_holistic_tracking(json_strings[0]);
    // holistic_result.updateLandmarks(json_strings[0]);
    playing = true;
    needs_update = true;
}).then();


var needs_update = false;
// buttonをおしたらフレームを移動する。
// TODO: 連打するとデッドロックがかかっている？ -> 解決
next_button.addEventListener("click", (event) => {
    if (json_strings !== null && !playing) {
        json_data_current_frame =
            (1 + json_data_current_frame) % json_data_frames;
        // holistic_result.updateLandmarks(
        //     json_strings[json_data_current_frame], scene);
        needs_update = true;
    }
});

prev_button.addEventListener("click", (event) => {
    if (json_strings !== null && !playing) {
        json_data_current_frame =
            (json_data_frames + json_data_current_frame - 1) % json_data_frames;
        // holistic_result.updateLandmarks(
        //     json_strings[json_data_current_frame], scene);
        needs_update = true;
    }
});

var tick_count = 1;
var skip_frames = 6;

play_button.addEventListener("click", (event) => {
    if (!playing) {
        playing = true;
        needs_update = true;
    }
});

pause_button.addEventListener("click", (event) => {
    playing = false;
});

stop_button.addEventListener("click", (event) => {
    playing = false;
    tick_count = 1;
    json_data_current_frame = 0;
});

var prev_time = 0
var current_time = 0

function animate() {
    requestAnimationFrame(animate);

    if (needs_update) {
        holistic_result.updateLandmarks(
            json_strings[json_data_current_frame]);
        needs_update = false;
        prev_time = Date.now();
    } else if (playing) {
        // TODO: 前回描画からの経過時間とタイムスタンプの差分を用いて適切な時刻に描画をする。
        // ループ処理も考える。

        // 現在時刻の取得
        current_time = Date.now();
        // 前回描画時の時刻との差分
        let diff_time = current_time - prev_time;

        let json_data_current_stamp = json_data_stamps[json_data_current_frame];
        let json_data_next_stamp =
            json_data_stamps[(1 + json_data_current_frame) % json_data_frames];
        let wait_time = (json_data_next_stamp - json_data_current_stamp) * 1e-3;
        if (wait_time <= 1) {
            wait_time = 100;
        }

        // if ((tick_count % skip_frames) === 0) {
        //     tick_count = 1;
        //     json_data_current_frame =
        //         (1 + json_data_current_frame) % json_data_frames;
        //     holistic_result.updateLandmarks(
        //         json_strings[json_data_current_frame], scene);
        // } else {
        //     tick_count++;
        // }

        // 更新するタイミング
        // current_time: 現在時刻
        // prev_time: 前に描画した時刻
        // diff_time: 前に描画してから経過した時間
        // wait_time: 描画を待つべき時間
        // diff_time - wait_time: 描画すべき時刻から経過した時間
        // current_time - (diff_time - wait_time): 本来描画すべきだった時刻
        if (diff_time > wait_time) {
            // tick_count = 1;
            json_data_current_frame =
                (1 + json_data_current_frame) % json_data_frames;
            holistic_result.updateLandmarks(
                json_strings[json_data_current_frame]);
            // prev_time = current_time - (diff_time - wait_time);
            prev_time += wait_time;
            console.log(current_time);
            console.log(wait_time);
            console.log(prev_time);
        } else {
            // tick_count++;
        }
    }

    controls.update();
    renderer.render(scene, camera);
}
animate();
