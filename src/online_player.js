import * as THREE from "three";
import { OrbitControls } from "@three-ts/orbit-controls";
import { AmbientLight, HemisphereLight } from "three";

import {invoke} from "@tauri-apps/api/tauri";
import {listen, emit} from "@tauri-apps/api/event";
import {appWindow} from "@tauri-apps/api/window";

import {MediapipeHolisticResult} from "./viewer";

const play_button = document.getElementById("play_anim");
const stop_button = document.getElementById("stop_anim");
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

var json_string = null;
var playing = false;
var needs_update = false;

var holistic_result = new MediapipeHolisticResult(scene, message_div);

// TODO: UDPで送信されてくる
// eventで送信されてきた文字列をjsonにする。
// jsonをパースして表示する。
const unlisten_upd_receive = listen("udp_receive", event => {
    json_string = event.payload.filetext;
    needs_update = true;
}).then();

// UDPの受付を開始
play_button.addEventListener("click", (event) => {
    if (!playing) {
        playing = true;
        needs_update = true;
        invoke("start_receive").then(
            () => {}
        );
    }
});

// UDPを閉じる
stop_button.addEventListener("click", (event) => {
    playing = false;
    emit("udp_stop", {}).then();
});

// TODO: 受け取ったパケットをファイルに書き込む部分を追加

var prev_time = 0
var current_time = 0

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
