import * as THREE from "three";

const material = new THREE.MeshLambertMaterial(
    {color: 0x00ff00}
);
const line_material = new THREE.LineBasicMaterial(
    {color: 0x00ff00}
);

const red_line_material = new THREE.LineBasicMaterial(
    {color: 0xff0000}
);
const green_line_material = new THREE.LineBasicMaterial(
    {color: 0x009900}
);
const blue_line_material = new THREE.LineBasicMaterial(
    {color: 0x0000ff}
);
const gray_line_material = new THREE.LineBasicMaterial(
    {color: 0x333333}
);

export function make_grid(scene) {
    for (let x = -1.0; x <= 1.0; x += 0.1) {
        let vec0 = new THREE.Vector3(x, -1.0, 0.0);
        let vec1 = new THREE.Vector3(x, 1.0, 0.0);
        let vecs = [vec0, vec1];
        let line = create_line_object_from_points(vecs, gray_line_material);
        scene.add(line);
    }
    for (let y = -1.0; y <= 1.0; y += 0.1) {
        let vec0 = new THREE.Vector3(-1.0, y, 0.0);
        let vec1 = new THREE.Vector3(1.0, y, 0.0);
        let vecs = [vec0, vec1];
        let line = create_line_object_from_points(vecs, gray_line_material);
        scene.add(line);
    }
}

function world_landmark_to_vector3(landmark) {
    let x = 0;
    let y = 0;
    let z = 0;
    try {
        x = landmark["x"];
        y = landmark["y"];
        z = landmark["z"];
        // console.log("(" + x + ", " + y + ", " + z + ")");
    } catch(e) {
        console.error("invlalid landmark");
    }
    return new THREE.Vector3(-x, -y, z);
}

function landmark_to_vector3(landmark, aspect_ratio) {
    let x = 0;
    let y = 0;
    let z = 0;
    try {
        x = (landmark["x"] - 0.5) / aspect_ratio;
        y = landmark["y"] - 0.5;
        z = landmark["z"] / aspect_ratio;
        // console.log("(" + x + ", " + y + ", " + z + ")");
    } catch(e) {
        console.error("invlalid landmark");
    }
    return new THREE.Vector3(-x, -y, z);
}

function create_line_object_from_points(points, material = line_material) {
    let geom = new THREE.BufferGeometry()
        .setFromPoints(points);
    return new THREE.Line(
        geom, material);
}

function update_line_object_from_points(lines, points) {
    lines.geometry.setFromPoints(points);
    lines.geometry.attributes.position.needsUpdate = true;
    lines.geometry.computeBoundingBox();
    lines.geometry.computeBoundingSphere();
}

function clear_line_object(lines) {
    if (lines !== null) {
        let npoints = lines.geometry.attributes.position.array.length / 3;
        let points = [];
        for (let i = 0; i < npoints; i++) {
            points.push(new THREE.Vector3(0, 0, 0));
        }
        update_line_object_from_points(lines, points);
    }
}


export function MediapipeHolisticResult(scene, message_div=null) {
    this.scene = scene;
    this.message_div = message_div;

    this.body_lines = null;
    this.right_arm_lines = null;
    this.right_leg_lines = null;
    this.left_arm_lines = null;
    this.left_leg_lines = null;

    this.face_lines = null;
    this.lip_0_lines = null;
    this.lip_1_lines = null;
    this.lip_2_lines = null;
    this.lip_3_lines = null;

    this.left_eye_0_lines = null;
    this.left_eye_1_lines = null;
    this.left_eyebrow_0_lines = null;
    this.left_eyebrow_1_lines = null;

    this.right_eye_0_lines = null;
    this.right_eye_1_lines = null;
    this.right_eyebrow_0_lines = null;
    this.right_eyebrow_1_lines = null;

    this.right_hand_thumb_lines = null;
    this.right_hand_index_lines = null;
    this.right_hand_middle_lines = null;
    this.right_hand_ring_lines = null;
    this.right_hand_pinky_lines = null;

    this.left_hand_thumb_lines = null;
    this.left_hand_index_lines = null;
    this.left_hand_middle_lines = null;
    this.left_hand_ring_lines = null;
    this.left_hand_pinky_lines = null;


    this.updateLandmarks = function (json_string) {
        if (json_string === "") {
            return;
        }

        try {
            // let msg = JSON.parse(json_strings[0]);
            let msg = JSON.parse(json_string);

            if (this.message_div !== null) {
                this.message_div.innerHTML = "";
                let title_camera_params = document.createElement("h2");
                title_camera_params.innerText = "camera_params";
                this.message_div.appendChild(title_camera_params);
            }

            let aspect_ratio = 1280.0 / 720.0;
            if ("camera_params" in msg) {
                let msg_camera_params = msg["camera_params"];
                aspect_ratio =
                    msg_camera_params["frame_width"] /
                    msg_camera_params["frame_height"];

                if (this.message_div !== null) {
                    let list_camera_params = document.createElement("ul");
                    let item_focal_length = document.createElement("li");
                    item_focal_length.innerText = "focal_length: " + msg_camera_params["focal_length"];
                    list_camera_params.appendChild(item_focal_length);
                    let item_frame_width = document.createElement("li");
                    item_frame_width.innerText = "frame_width: " + msg_camera_params["frame_width"];
                    list_camera_params.appendChild(item_frame_width);
                    let item_frame_height = document.createElement("li");
                    item_frame_height.innerText = "frame_height: " + msg_camera_params["frame_height"];
                    list_camera_params.appendChild(item_frame_height);
                    this.message_div.appendChild(list_camera_params);
                }
            } else {
                if (this.message_div !== null) {
                    let p_not_found = document.createElement("p");
                    p_not_found.innerText = "not found";
                    this.message_div.appendChild(p_not_found);
                }
            }

            if (this.message_div !== null) {
                let title_gravity = document.createElement("h2");
                title_gravity.innerText = "gravity";
                this.message_div.appendChild(title_gravity);
                if ("gravity" in msg) {
                    let msg_gravity = msg["gravity"];
                    let p_gravity = document.createElement("p");
                    p_gravity.innerText =
                    "[" +
                        msg_gravity[0] + ", " +
                        msg_gravity[1] + ", " +
                        msg_gravity[2] + "]";
                    this.message_div.appendChild(p_gravity);
                } else {
                    let p_not_found = document.createElement("p");
                    p_not_found.innerText = "not found";
                    this.message_div.appendChild(p_not_found);
                }
            }


            if ("pose_landmarks" in msg) {
                let msg_pose_landmarks = msg["pose_landmarks"];
            } else {
            }

            let pose_world_nose = new THREE.Vector3(0, 0, 0);
            let pose_world_right_hand = new THREE.Vector3(0, 0, 0);
            let pose_world_left_hand = new THREE.Vector3(0, 0, 0);
            if ("pose_world_landmarks" in msg) {
                let msg_pose_world_landmarks =
                    msg["pose_world_landmarks"];

                pose_world_nose =
                    world_landmark_to_vector3(
                        msg_pose_world_landmarks[0]);
                pose_world_right_hand =
                    world_landmark_to_vector3(
                        msg_pose_world_landmarks[16]);
                pose_world_left_hand =
                    world_landmark_to_vector3(
                        msg_pose_world_landmarks[15]);

                let body_points = [];
                let body_indices = [11, 12, 24, 23, 11];
                for (const i of body_indices) {
                    body_points.push(
                        world_landmark_to_vector3(
                            msg_pose_world_landmarks[i]));
                }
                if (this.body_lines === null) {
                    this.body_lines =
                        create_line_object_from_points(
                            body_points, gray_line_material);
                    this.scene.add(this.body_lines);
                } else {
                    update_line_object_from_points(this.body_lines, body_points);
                }


                let right_arm_points = [];
                let right_arm_indices = [12, 14, 16, 18, 20, 16, 22];
                for (const i of right_arm_indices) {
                    right_arm_points.push(
                        world_landmark_to_vector3(
                            msg_pose_world_landmarks[i]));
                }
                if (this.right_arm_lines === null) {
                    this.right_arm_lines =
                        create_line_object_from_points(
                            right_arm_points, red_line_material);
                    this.scene.add(this.right_arm_lines);
                } else {
                    update_line_object_from_points(this.right_arm_lines, right_arm_points);
                }

                let right_leg_points = [];
                let right_leg_indices = [24, 26, 28, 30, 32, 28];
                for (const i of right_leg_indices) {
                    right_leg_points.push(
                        world_landmark_to_vector3(
                            msg_pose_world_landmarks[i]));
                }
                if (this.right_leg_lines === null) {
                    this.right_leg_lines =
                        create_line_object_from_points(
                            right_leg_points, red_line_material);
                    this.scene.add(this.right_leg_lines);
                } else {
                    update_line_object_from_points(this.right_leg_lines, right_leg_points);
                }


                let left_arm_points = [];
                let left_arm_indices = [11, 13, 15, 17, 19, 15, 21];
                for (const i of left_arm_indices) {
                    left_arm_points.push(
                        world_landmark_to_vector3(
                            msg_pose_world_landmarks[i]));
                }
                if (this.left_arm_lines === null) {
                    this.left_arm_lines =
                        create_line_object_from_points(
                            left_arm_points, blue_line_material);
                    this.scene.add(this.left_arm_lines);
                } else {
                    update_line_object_from_points(this.left_arm_lines, left_arm_points);
                }

                let left_leg_points = [];
                let left_leg_indices = [23, 25, 27, 29, 31, 27];
                for (const i of left_leg_indices) {
                    left_leg_points.push(
                        world_landmark_to_vector3(
                            msg_pose_world_landmarks[i]));
                }
                if (this.left_leg_lines === null) {
                    this.left_leg_lines =
                        create_line_object_from_points(
                            left_leg_points, blue_line_material);
                    this.scene.add(this.left_leg_lines);
                } else {
                    update_line_object_from_points(this.left_leg_lines, left_leg_points);
                }
            } else {
                clear_line_object(this.body_lines);
                clear_line_object(this.right_arm_lines);
                clear_line_object(this.right_leg_lines);
                clear_line_object(this.left_arm_lines);
                clear_line_object(this.left_leg_lines);
            }


            if ("face_landmarks" in msg) {
                let msg_face_landmarks = msg["face_landmarks"];

                let face_nose =
                    landmark_to_vector3(
                        msg_face_landmarks[0], aspect_ratio);

                let face_points = [];
                let face_indices = [
                    10, 338, 297, 332, 284,
                    251, 389, 356, 454, 323,
                    361, 288, 397, 365, 379,
                    378, 400, 377, 152, 148,
                    176, 149, 150, 136, 172,
                    58, 132, 93, 234, 127,
                    162, 21, 54, 103, 67,
                    109, 10
                ];
                for (const i of face_indices) {
                    face_points.push(
                        landmark_to_vector3(
                            msg_face_landmarks[i], aspect_ratio)
                        .sub(face_nose)
                        .multiplyScalar(2.0)
                        .add(pose_world_nose));
                }
                if (this.face_lines === null) {
                    this.face_lines =
                        create_line_object_from_points(
                            face_points, green_line_material);
                    this.scene.add(this.face_lines);
                } else {
                    update_line_object_from_points(this.face_lines, face_points);
                }

                let lip_0_points = [];
                let lip_0_indices = [
                    61, 146, 91, 181, 84,
                    17, 314, 405, 321, 375,
                    291
                ];
                for (const i of lip_0_indices) {
                    lip_0_points.push(
                        landmark_to_vector3(
                            msg_face_landmarks[i], aspect_ratio)
                        .sub(face_nose)
                        .multiplyScalar(2.0)
                        .add(pose_world_nose));
                }
                if (this.lip_0_lines === null) {
                    this.lip_0_lines =
                        create_line_object_from_points(
                            lip_0_points, green_line_material);
                    this.scene.add(this.lip_0_lines);
                } else {
                    update_line_object_from_points(this.lip_0_lines, lip_0_points);
                }


                let lip_1_points = [];
                let lip_1_indices = [
                    61, 185, 40, 39, 37,
                    0, 267, 269, 270, 409,
                    291
                ];
                for (const i of lip_1_indices) {
                    lip_1_points.push(
                        landmark_to_vector3(
                            msg_face_landmarks[i], aspect_ratio)
                        .sub(face_nose)
                        .multiplyScalar(2.0)
                        .add(pose_world_nose));
                }
                if (this.lip_1_lines === null) {
                    this.lip_1_lines =
                        create_line_object_from_points(
                            lip_1_points, green_line_material);
                    this.scene.add(this.lip_1_lines);
                } else {
                    update_line_object_from_points(this.lip_1_lines, lip_1_points);
                }

                let lip_2_points = [];
                let lip_2_indices = [
                    78, 95, 88, 178, 87,
                    14, 317, 402, 318, 324,
                    308
                ];
                for (const i of lip_2_indices) {
                    lip_2_points.push(
                        landmark_to_vector3(
                            msg_face_landmarks[i], aspect_ratio)
                        .sub(face_nose)
                        .multiplyScalar(2.0)
                        .add(pose_world_nose));
                }
                if (this.lip_2_lines === null) {
                    this.lip_2_lines =
                        create_line_object_from_points(
                            lip_2_points, green_line_material);
                    this.scene.add(this.lip_2_lines);
                } else {
                    update_line_object_from_points(this.lip_2_lines, lip_2_points);
                }

                let lip_3_points = [];
                let lip_3_indices = [
                    78, 191, 80, 81, 82,
                    13, 312, 311, 310, 415,
                    308
                ];
                for (const i of lip_3_indices) {
                    lip_3_points.push(
                        landmark_to_vector3(
                            msg_face_landmarks[i], aspect_ratio)
                        .sub(face_nose)
                        .multiplyScalar(2.0)
                        .add(pose_world_nose));
                }
                if (this.lip_3_lines === null) {
                    this.lip_3_lines =
                        create_line_object_from_points(
                            lip_3_points, green_line_material);
                    this.scene.add(this.lip_3_lines);
                } else {
                    update_line_object_from_points(this.lip_3_lines, lip_3_points);
                }

                let left_eye_0_points = [];
                let left_eye_0_indices = [
                    263, 249, 390, 373, 374,
                    380, 381, 382, 362
                ];
                for (const i of left_eye_0_indices) {
                    left_eye_0_points.push(
                        landmark_to_vector3(
                            msg_face_landmarks[i], aspect_ratio)
                        .sub(face_nose)
                        .multiplyScalar(2.0)
                        .add(pose_world_nose));
                }
                if (this.left_eye_0_lines === null) {
                    this.left_eye_0_lines =
                        create_line_object_from_points(
                            left_eye_0_points, green_line_material);
                    this.scene.add(this.left_eye_0_lines);
                } else {
                    update_line_object_from_points(this.left_eye_0_lines, left_eye_0_points);
                }


                let left_eye_1_points = [];
                let left_eye_1_indices = [
                    263, 466, 388, 387, 386,
                    385, 384, 398, 362
                ];
                for (const i of left_eye_1_indices) {
                    left_eye_1_points.push(
                        landmark_to_vector3(
                            msg_face_landmarks[i], aspect_ratio)
                        .sub(face_nose)
                        .multiplyScalar(2.0)
                        .add(pose_world_nose));
                }
                if (this.left_eye_1_lines === null) {
                    this.left_eye_1_lines =
                        create_line_object_from_points(
                            left_eye_1_points, green_line_material);
                    this.scene.add(this.left_eye_1_lines);
                } else {
                    update_line_object_from_points(this.left_eye_1_lines, left_eye_1_points);
                }

                let left_eyebrow_0_points = [];
                let left_eyebrow_0_indices = [
                    276, 283, 282, 295, 285
                ];
                for (const i of left_eyebrow_0_indices) {
                    left_eyebrow_0_points.push(
                        landmark_to_vector3(
                            msg_face_landmarks[i], aspect_ratio)
                        .sub(face_nose)
                        .multiplyScalar(2.0)
                        .add(pose_world_nose));
                }
                if (this.left_eyebrow_0_lines === null) {
                    this.left_eyebrow_0_lines =
                        create_line_object_from_points(
                            left_eyebrow_0_points, green_line_material);
                    this.scene.add(this.left_eyebrow_0_lines);
                } else {
                    update_line_object_from_points(this.left_eyebrow_0_lines, left_eyebrow_0_points);
                }

                let left_eyebrow_1_points = [];
                let left_eyebrow_1_indices = [
                    300, 293, 334, 296, 336
                ];
                for (const i of left_eyebrow_1_indices) {
                    left_eyebrow_1_points.push(
                        landmark_to_vector3(
                            msg_face_landmarks[i], aspect_ratio)
                        .sub(face_nose)
                        .multiplyScalar(2.0)
                        .add(pose_world_nose));
                }
                if (this.left_eyebrow_1_lines === null) {
                    this.left_eyebrow_1_lines =
                        create_line_object_from_points(
                            left_eyebrow_1_points, green_line_material);
                    this.scene.add(this.left_eyebrow_1_lines);
                } else {
                    update_line_object_from_points(this.left_eyebrow_1_lines, left_eyebrow_1_points);
                }


                let right_eye_0_points = [];
                let right_eye_0_indices = [
                    33, 7, 163, 144, 145,
                    153, 154, 155, 133
                ];
                for (const i of right_eye_0_indices) {
                    right_eye_0_points.push(
                        landmark_to_vector3(
                            msg_face_landmarks[i], aspect_ratio)
                        .sub(face_nose)
                        .multiplyScalar(2.0)
                        .add(pose_world_nose));
                }
                if (this.right_eye_0_lines === null) {
                    this.right_eye_0_lines =
                        create_line_object_from_points(
                            right_eye_0_points, green_line_material);
                    this.scene.add(this.right_eye_0_lines);
                } else {
                    update_line_object_from_points(this.right_eye_0_lines, right_eye_0_points);
                }

                let right_eye_1_points = [];
                let right_eye_1_indices = [
                    33, 246, 161, 160, 159,
                    158, 157, 173, 133
                ];
                for (const i of right_eye_1_indices) {
                    right_eye_1_points.push(
                        landmark_to_vector3(
                            msg_face_landmarks[i], aspect_ratio)
                        .sub(face_nose)
                        .multiplyScalar(2.0)
                        .add(pose_world_nose));
                }
                if (this.right_eye_1_lines === null) {
                    this.right_eye_1_lines =
                        create_line_object_from_points(
                            right_eye_1_points, green_line_material);
                    this.scene.add(this.right_eye_1_lines);
                } else {
                    update_line_object_from_points(this.right_eye_1_lines, right_eye_1_points);
                }

                let right_eyebrow_0_points = [];
                let right_eyebrow_0_indices = [
                    46, 53, 52, 65, 55
                ];
                for (const i of right_eyebrow_0_indices) {
                    right_eyebrow_0_points.push(
                        landmark_to_vector3(
                            msg_face_landmarks[i], aspect_ratio)
                        .sub(face_nose)
                        .multiplyScalar(2.0)
                        .add(pose_world_nose));
                }
                if (this.right_eyebrow_0_lines === null) {
                    this.right_eyebrow_0_lines =
                        create_line_object_from_points(
                            right_eyebrow_0_points, green_line_material);
                    this.scene.add(this.right_eyebrow_0_lines);
                } else {
                    update_line_object_from_points(this.right_eyebrow_0_lines, right_eyebrow_0_points);
                }

                let right_eyebrow_1_points = [];
                let right_eyebrow_1_indices = [
                    70, 63, 105, 66, 107
                ];
                for (const i of right_eyebrow_1_indices) {
                    right_eyebrow_1_points.push(
                        landmark_to_vector3(
                            msg_face_landmarks[i], aspect_ratio)
                        .sub(face_nose)
                        .multiplyScalar(2.0)
                        .add(pose_world_nose));
                }
                if (this.right_eyebrow_1_lines === null) {
                    this.right_eyebrow_1_lines =
                        create_line_object_from_points(
                            right_eyebrow_1_points, green_line_material);
                    this.scene.add(this.right_eyebrow_1_lines);
                } else {
                    update_line_object_from_points(this.right_eyebrow_1_lines, right_eyebrow_1_points);
                }

            } else {
                clear_line_object(this.face_lines);
                clear_line_object(this.lip_0_lines);
                clear_line_object(this.lip_1_lines);
                clear_line_object(this.lip_2_lines);
                clear_line_object(this.lip_3_lines);
                clear_line_object(this.left_eye_0_lines);
                clear_line_object(this.left_eye_1_lines);
                clear_line_object(this.left_eyebrow_0_lines);
                clear_line_object(this.left_eyebrow_1_lines);
                clear_line_object(this.right_eye_0_lines);
                clear_line_object(this.right_eye_1_lines);
                clear_line_object(this.right_eyebrow_0_lines);
                clear_line_object(this.right_eyebrow_1_lines);
            }


            if ("right_hand_landmarks" in msg) {
                let msg_right_hand_landmarks = msg["right_hand_landmarks"];
                let right_hand_root =
                    landmark_to_vector3(
                        msg_right_hand_landmarks[0], aspect_ratio);

                let right_hand_thumb_points = [];
                let right_hand_thumb_indices = [
                    0, 1, 2, 3, 4
                ];
                for (const i of right_hand_thumb_indices) {
                    right_hand_thumb_points.push(
                        landmark_to_vector3(
                            msg_right_hand_landmarks[i], aspect_ratio)
                        .sub(right_hand_root)
                        .multiplyScalar(2.0)
                        .add(pose_world_right_hand));
                }
                if (this.right_hand_thumb_lines === null) {
                    this.right_hand_thumb_lines =
                        create_line_object_from_points(
                            right_hand_thumb_points, red_line_material);
                    this.scene.add(this.right_hand_thumb_lines);
                } else {
                    update_line_object_from_points(this.right_hand_thumb_lines, right_hand_thumb_points);
                }

                let right_hand_index_points = [];
                let right_hand_index_indices = [
                    0, 5, 6, 7, 8
                ];
                for (const i of right_hand_index_indices) {
                    right_hand_index_points.push(
                        landmark_to_vector3(
                            msg_right_hand_landmarks[i], aspect_ratio)
                        .sub(right_hand_root)
                        .multiplyScalar(2.0)
                        .add(pose_world_right_hand));
                }
                if (this.right_hand_index_lines === null) {
                    this.right_hand_index_lines =
                        create_line_object_from_points(
                            right_hand_index_points, red_line_material);
                    this.scene.add(this.right_hand_index_lines);
                } else {
                    update_line_object_from_points(this.right_hand_index_lines, right_hand_index_points);
                }

                let right_hand_middle_points = [];
                let right_hand_middle_indices = [
                    0, 9, 10, 11, 12
                ];
                for (const i of right_hand_middle_indices) {
                    right_hand_middle_points.push(
                        landmark_to_vector3(
                            msg_right_hand_landmarks[i], aspect_ratio)
                        .sub(right_hand_root)
                        .multiplyScalar(2.0)
                        .add(pose_world_right_hand));
                }
                if (this.right_hand_middle_lines === null) {
                    this.right_hand_middle_lines =
                        create_line_object_from_points(
                            right_hand_middle_points, red_line_material);
                    this.scene.add(this.right_hand_middle_lines);
                } else {
                    update_line_object_from_points(this.right_hand_middle_lines, right_hand_middle_points);
                }

                let right_hand_ring_points = [];
                let right_hand_ring_indices = [
                    0, 13, 14, 15, 16
                ];
                for (const i of right_hand_ring_indices) {
                    right_hand_ring_points.push(
                        landmark_to_vector3(
                            msg_right_hand_landmarks[i], aspect_ratio)
                        .sub(right_hand_root)
                        .multiplyScalar(2.0)
                        .add(pose_world_right_hand));
                }
                if (this.right_hand_ring_lines === null) {
                    this.right_hand_ring_lines =
                        create_line_object_from_points(
                            right_hand_ring_points, red_line_material);
                    this.scene.add(this.right_hand_ring_lines);
                } else {
                    update_line_object_from_points(this.right_hand_ring_lines, right_hand_ring_points);
                }

                let right_hand_pinky_points = [];
                let right_hand_pinky_indices = [
                    0, 17, 18, 19, 20
                ];
                for (const i of right_hand_pinky_indices) {
                    right_hand_pinky_points.push(
                        landmark_to_vector3(
                            msg_right_hand_landmarks[i], aspect_ratio)
                        .sub(right_hand_root)
                        .multiplyScalar(2.0)
                        .add(pose_world_right_hand));
                }
                if (this.right_hand_pinky_lines === null) {
                    this.right_hand_pinky_lines =
                        create_line_object_from_points(
                            right_hand_pinky_points, red_line_material);
                    this.scene.add(this.right_hand_pinky_lines);
                } else {
                    update_line_object_from_points(this.right_hand_pinky_lines, right_hand_pinky_points);
                }

            } else {
                clear_line_object(this.right_hand_thumb_lines);
                clear_line_object(this.right_hand_index_lines);
                clear_line_object(this.right_hand_middle_lines);
                clear_line_object(this.right_hand_ring_lines);
                clear_line_object(this.right_hand_pinky_lines);
            }


            if ("left_hand_landmarks" in msg) {
                let msg_left_hand_landmarks = msg["left_hand_landmarks"];
                let left_hand_root =
                landmark_to_vector3(
                    msg_left_hand_landmarks[0], aspect_ratio);

                let left_hand_thumb_points = [];
                let left_hand_thumb_indices = [
                    0, 1, 2, 3, 4
                ];
                for (const i of left_hand_thumb_indices) {
                    left_hand_thumb_points.push(
                        landmark_to_vector3(
                            msg_left_hand_landmarks[i], aspect_ratio)
                        .sub(left_hand_root)
                        .multiplyScalar(2.0)
                        .add(pose_world_left_hand));
                }
                if (this.left_hand_thumb_lines === null) {
                    this.left_hand_thumb_lines =
                        create_line_object_from_points(
                            left_hand_thumb_points, blue_line_material);
                    this.scene.add(this.left_hand_thumb_lines);
                } else {
                    update_line_object_from_points(this.left_hand_thumb_lines, left_hand_thumb_points);
                }

                let left_hand_index_points = [];
                let left_hand_index_indices = [
                    0, 5, 6, 7, 8
                ];
                for (const i of left_hand_index_indices) {
                    left_hand_index_points.push(
                        landmark_to_vector3(
                            msg_left_hand_landmarks[i], aspect_ratio)
                        .sub(left_hand_root)
                        .multiplyScalar(2.0)
                        .add(pose_world_left_hand));
                }
                if (this.left_hand_index_lines === null) {
                    this.left_hand_index_lines =
                        create_line_object_from_points(
                            left_hand_index_points, blue_line_material);
                    this.scene.add(this.left_hand_index_lines);
                } else {
                    update_line_object_from_points(this.left_hand_index_lines, left_hand_index_points);
                }

                let left_hand_middle_points = [];
                let left_hand_middle_indices = [
                    0, 9, 10, 11, 12
                ];
                for (const i of left_hand_middle_indices) {
                    left_hand_middle_points.push(
                        landmark_to_vector3(
                            msg_left_hand_landmarks[i], aspect_ratio)
                        .sub(left_hand_root)
                        .multiplyScalar(2.0)
                        .add(pose_world_left_hand));
                }
                if (this.left_hand_middle_lines === null) {
                    this.left_hand_middle_lines =
                        create_line_object_from_points(
                            left_hand_middle_points, blue_line_material);
                    this.scene.add(this.left_hand_middle_lines);
                } else {
                    update_line_object_from_points(this.left_hand_middle_lines, left_hand_middle_points);
                }

                let left_hand_ring_points = [];
                let left_hand_ring_indices = [
                    0, 13, 14, 15, 16
                ];
                for (const i of left_hand_ring_indices) {
                    left_hand_ring_points.push(
                        landmark_to_vector3(
                            msg_left_hand_landmarks[i], aspect_ratio)
                        .sub(left_hand_root)
                        .multiplyScalar(2.0)
                        .add(pose_world_left_hand));
                }
                if (this.left_hand_ring_lines === null) {
                    this.left_hand_ring_lines =
                        create_line_object_from_points(
                            left_hand_ring_points, blue_line_material);
                    this.scene.add(this.left_hand_ring_lines);
                } else {
                    update_line_object_from_points(this.left_hand_ring_lines, left_hand_ring_points);
                }

                let left_hand_pinky_points = [];
                let left_hand_pinky_indices = [
                    0, 17, 18, 19, 20
                ];
                for (const i of left_hand_pinky_indices) {
                    left_hand_pinky_points.push(
                        landmark_to_vector3(
                            msg_left_hand_landmarks[i], aspect_ratio)
                        .sub(left_hand_root)
                        .multiplyScalar(2.0)
                        .add(pose_world_left_hand));
                }
                if (this.left_hand_pinky_lines === null) {
                    this.left_hand_pinky_lines =
                        create_line_object_from_points(
                            left_hand_pinky_points, blue_line_material);
                    this.scene.add(this.left_hand_pinky_lines);
                } else {
                    update_line_object_from_points(this.left_hand_pinky_lines, left_hand_pinky_points);
                }
            } else {
                clear_line_object(this.left_hand_thumb_lines);
                clear_line_object(this.left_hand_index_lines);
                clear_line_object(this.left_hand_middle_lines);
                clear_line_object(this.left_hand_ring_lines);
                clear_line_object(this.left_hand_pinky_lines);
            }


        } catch(e) {
            console.error(e);
        }
    }
}
