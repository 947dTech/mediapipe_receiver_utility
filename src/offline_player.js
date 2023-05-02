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

var json_string = null;
var playing = false;
var needs_update = false;
var counter_reset = false;

var holistic_result = new MediapipeHolisticResult(scene, message_div);

// メニューからファイルを開くと、eventがとんでくる。
// eventを受け取ったらinvokeでファイルを開く。
const unlisten_open_menu = listen("open_menu", event => {
    console.log("open_menu called.");
    invoke("open_file").then();
}).then();

// buttonをおしたらフレームを移動する。
next_button.addEventListener("click", (event) => {
    if (!playing) {
        invoke("step_json", {
            increment: true,
            counterReset: counter_reset
        }).then();
        needs_update = true;
    }
});

prev_button.addEventListener("click", (event) => {
    if (!playing) {
        invoke("step_json", {
            increment: false,
            counterReset: counter_reset
        }).then();
        needs_update = true;
    }
});

// invokeしてRust側で送信スレッドを開始する。
play_button.addEventListener("click", (event) => {
    if (!playing) {
        playing = true;
        invoke("start_json", {
            counterReset: counter_reset
        }).then();
    }
});

// counterをリセットせずに停止する。
pause_button.addEventListener("click", (event) => {
    playing = false;
    counter_reset = false;  // 次回のinvokeで渡すようにする。
    emit("json_stop", {}).then();
});

// counterをリセットして停止する。
stop_button.addEventListener("click", (event) => {
    playing = false;
    counter_reset = true;  // 次回のinvokeで渡すようにする。
    emit("json_stop", {}).then();
});

// Rust側からeventで1フレームごとに送られてくる。
// jsonをパースして表示する。
const unlisten_json_send = listen("json_send", event => {
    json_string = event.payload.filetext;
    needs_update = true;
}).then();

function animate() {
    requestAnimationFrame(animate);

    if (needs_update) {
        holistic_result.updateLandmarks(json_string);
        needs_update = false;
    }

    controls.update();
    renderer.render(scene, camera);
}
animate();
