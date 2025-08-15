import {invoke} from "@tauri-apps/api/core";
import {listen, emit} from "@tauri-apps/api/event";
import {getCurrentWebviewWindow} from "@tauri-apps/api/webviewWindow";
const appWindow = getCurrentWebviewWindow()

const message_div = document.getElementById("message_div");
// const textfield = document.getElementById("textfield");

// eventで送信されてきた文字列をjsonにする。
// jsonをパースして表示する。
const unlisten_open_file = listen("open_file", event => {
    var json_strings = event.payload.filetext.split("\n");

    // textfield.value = event.payload.filetext;
    // textfield.value = json_strings.length;

    message_div.innreHTML = "";
    try {
        let msg = JSON.parse(json_strings[0]);
        // textfield.value = "";
        // textfield.value +=
        //     ("camera_params: " + JSON.stringify(msg["camera_params"]))


        let title_camera_params = document.createElement("h2");
        title_camera_params.innerText = "camera_params";
        message_div.appendChild(title_camera_params);
        if ("camera_params" in msg) {
            let msg_camera_params = msg["camera_params"];
            let list_camera_params = document.createElement("ul");
            message_div.appendChild(list_camera_params);
            let item_focal_length = document.createElement("li");
            item_focal_length.innerText = "focal_length: " + msg_camera_params["focal_length"];
            list_camera_params.appendChild(item_focal_length);
            let item_frame_width = document.createElement("li");
            item_frame_width.innerText = "frame_width: " + msg_camera_params["frame_width"];
            list_camera_params.appendChild(item_frame_width);
            let item_frame_height = document.createElement("li");
            item_frame_height.innerText = "frame_height: " + msg_camera_params["frame_height"];
            list_camera_params.appendChild(item_frame_height);
        } else {
            let p_not_found = document.createElement("p");
            p_not_found.innerText = "not found";
            message_div.appendChild(p_not_found);
        }


        let title_gravity = document.createElement("h2");
        title_gravity.innerText = "gravity";
        message_div.appendChild(title_gravity);
        if ("gravity" in msg) {
            let msg_gravity = msg["gravity"];
            let p_gravity = document.createElement("p");
            p_gravity.innerText =
              "[" +
                msg_gravity[0] + ", " +
                msg_gravity[1] + ", " +
                msg_gravity[2] + "]";
            message_div.appendChild(p_gravity);
        } else {
            let p_not_found = document.createElement("p");
            p_not_found.innerText = "not found";
            message_div.appendChild(p_not_found);
        }


        let title_pose = document.createElement("h2");
        title_pose.innerText = "pose_landmarks";
        message_div.appendChild(title_pose);
        if ("pose_landmarks" in msg) {
            let msg_pose_landmarks = msg["pose_landmarks"];
            let pose_landmarks_stamp = msg["pose_landmarks_stamp"];
            let p_pose_landmarks_stamp = document.createElement("p");
            p_pose_landmarks_stamp.innerText =
              "pose_landmarks_stamp: " + pose_landmarks_stamp;
            message_div.appendChild(p_pose_landmarks_stamp);
        } else {
            let p_not_found = document.createElement("p");
            p_not_found.innerText = "not found";
            message_div.appendChild(p_not_found);
        }


        let title_pose_world = document.createElement("h2");
        title_pose_world.innerText = "pose_world_landmarks";
        message_div.appendChild(title_pose_world);
        if ("pose_world_landmarks" in msg) {
            let msg_pose_world_landmarks = msg["pose_world_landmarks"];
            let pose_world_landmarks_stamp = msg["pose_world_landmarks_stamp"];
            let p_pose_world_landmarks_stamp = document.createElement("p");
            p_pose_world_landmarks_stamp.innerText =
              "pose_world_landmarks_stamp: " + pose_world_landmarks_stamp;
            message_div.appendChild(p_pose_world_landmarks_stamp);
        } else {
            let p_not_found = document.createElement("p");
            p_not_found.innerText = "not found";
            message_div.appendChild(p_not_found);
        }


        let title_face = document.createElement("h2");
        title_face.innerText = "face_landmarks";
        message_div.appendChild(title_face);
        if ("face_landmarks" in msg) {
            let msg_face_landmarks = msg["face_landmarks"];
            let face_landmarks_stamp = msg["face_landmarks_stamp"];
            let p_face_landmarks_stamp = document.createElement("p");
            p_face_landmarks_stamp.innerText =
              "face_landmarks_stamp: " + face_landmarks_stamp;
            message_div.appendChild(p_face_landmarks_stamp);
        } else {
            let p_not_found = document.createElement("p");
            p_not_found.innerText = "not found";
            message_div.appendChild(p_not_found);
        }


        let title_right_hand = document.createElement("h2");
        title_right_hand.innerText = "right_hand_landmarks";
        message_div.appendChild(title_right_hand);
        if ("right_hand_landmarks" in msg) {
            let msg_right_hand_landmarks = msg["right_hand_landmarks"];
            let right_hand_landmarks_stamp = msg["right_hand_landmarks_stamp"];
            let p_right_hand_landmarks_stamp = document.createElement("p");
            p_right_hand_landmarks_stamp.innerText =
              "right_hand_landmarks_stamp: " + right_hand_landmarks_stamp;
            message_div.appendChild(p_right_hand_landmarks_stamp);
        } else {
            let p_not_found = document.createElement("p");
            p_not_found.innerText = "not found";
            message_div.appendChild(p_not_found);
        }


        let title_left_hand = document.createElement("h2");
        title_left_hand.innerText = "left_hand_landmarks";
        message_div.appendChild(title_left_hand);
        if ("left_hand_landmarks" in msg) {
            let msg_left_hand_landmarks = msg["left_hand_landmarks"];
            let left_hand_landmarks_stamp = msg["left_hand_landmarks_stamp"];
            let p_left_hand_landmarks_stamp = document.createElement("p");
            p_left_hand_landmarks_stamp.innerText =
              "left_hand_landmarks_stamp: " + left_hand_landmarks_stamp;
            message_div.appendChild(p_left_hand_landmarks_stamp);
        } else {
            let p_not_found = document.createElement("p");
            p_not_found.innerText = "not found";
            message_div.appendChild(p_not_found);
        }


    } catch(e) {
        console.error(e);
    }
}).then();
