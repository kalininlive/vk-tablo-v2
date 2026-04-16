#!/usr/bin/env python3
import configparser
import json
import os
import signal
import subprocess
import threading
import time
from typing import Any, Dict, Optional

import psycopg2
from flask import Flask, jsonify, request

app = Flask(__name__, threaded=True)

API_PORT = 5000
API_SECRET = os.getenv("CONTROL_SECRET", "")
XVFB_DISPLAY = ":99"
OBS_HOME = "/root/.config/obs-studio"

obs_process: Optional[subprocess.Popen] = None
xvfb_process: Optional[subprocess.Popen] = None
_stream_lock = threading.Lock()


def db_conn():
    return psycopg2.connect(
        host="127.0.0.1",
        port=5432,
        dbname="postgres",
        user="postgres",
        password=os.getenv("DB_PASSWORD", ""),
    )


def require_secret() -> Optional[Any]:
    if request.method == "GET" and request.path == "/status":
        return None
    if not API_SECRET:
        return jsonify({"error": "CONTROL_SECRET is not configured"}), 500
    if request.headers.get("x-secret", "") != API_SECRET:
        return jsonify({"error": "unauthorized"}), 401
    return None


@app.before_request
def auth_middleware():
    result = require_secret()
    if result is not None:
        return result
    return None


def is_alive(proc: Optional[subprocess.Popen]) -> bool:
    return proc is not None and proc.poll() is None


def read_active_channel() -> Optional[Dict[str, str]]:
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT rtmp_url, stream_key FROM vk_channels WHERE is_active = true ORDER BY id ASC LIMIT 1"
            )
            row = cur.fetchone()
            if not row:
                return None
            return {"rtmp_url": row[0], "stream_key": row[1]}


def ensure_obs_files(channel: Dict[str, str]):
    obs_home = OBS_HOME
    basic_dir = os.path.join(obs_home, "basic")
    scenes_dir = os.path.join(basic_dir, "scenes")
    profile_dir = os.path.join(basic_dir, "profiles", "vk-stream")

    os.makedirs(scenes_dir, exist_ok=True)
    os.makedirs(profile_dir, exist_ok=True)

    scene_json = {
        "current_program_scene": "Main",
        "current_scene": "Main",
        "name": "vk-stream",
        "groups": [],
        "quick_transitions": [],
        "saved_projectors": [],
        "sources": [
            {
                "name": "Camera",
                "id": "ffmpeg_source",
                "settings": {
                    "input": "rtmp://localhost/live/stream",
                    "is_local_file": False,
                },
                "mixers": 255,
                "versioned_id": "ffmpeg_source",
            },
            {
                "name": "Overlay",
                "id": "browser_source",
                "settings": {
                    "url": f"https://{os.getenv('SERVER_HOST', 'localhost')}/overlay",
                    "width": 1920,
                    "height": 1080,
                    "fps": 30,
                    "css": "body { background: transparent !important; margin: 0; overflow: hidden; }",
                    "shutdown": True,
                },
                "mixers": 255,
                "versioned_id": "browser_source",
            },
        ],
        "scene_order": [{"name": "Main"}],
        "scenes": [
            {
                "name": "Main",
                "sources": [
                    {
                        "name": "Camera",
                        "id": "ffmpeg_source",
                        "visible": True,
                        "locked": False,
                        "rot": 0.0,
                        "pos": {"x": 0.0, "y": 0.0},
                        "scale": {"x": 1.0, "y": 1.0},
                        "align": 5,
                        "bounds_type": 0,
                        "bounds_align": 0,
                        "bounds": {"x": 0.0, "y": 0.0},
                        "crop_top": 0,
                        "crop_bottom": 0,
                        "crop_left": 0,
                        "crop_right": 0,
                    },
                    {
                        "name": "Overlay",
                        "id": "browser_source",
                        "visible": True,
                        "locked": False,
                        "rot": 0.0,
                        "pos": {"x": 0.0, "y": 0.0},
                        "scale": {"x": 1.0, "y": 1.0},
                        "align": 5,
                        "bounds_type": 0,
                        "bounds_align": 0,
                        "bounds": {"x": 0.0, "y": 0.0},
                        "crop_top": 0,
                        "crop_bottom": 0,
                        "crop_left": 0,
                        "crop_right": 0,
                    },
                ],
            }
        ],
    }

    with open(os.path.join(scenes_dir, "vk-stream.json"), "w", encoding="utf-8") as f:
        json.dump(scene_json, f)

    with open(os.path.join(profile_dir, "basic.ini"), "w", encoding="utf-8") as f:
        f.write(
            """[General]
Name=vk-stream

[Video]
BaseCX=1920
BaseCY=1080
OutputCX=1920
OutputCY=1080
FPSType=0
FPSCommon=30

[Output]
Mode=Simple
VBitrate=3000
StreamEncoder=x264
RecQuality=Small
RecEncoder=x264
"""
        )

    with open(os.path.join(profile_dir, "service.json"), "w", encoding="utf-8") as f:
        json.dump(
            {
                "type": "rtmp_custom",
                "settings": {
                    "server": channel["rtmp_url"],
                    "key": channel["stream_key"],
                },
            },
            f,
        )

    with open(os.path.join(obs_home, "global.ini"), "w", encoding="utf-8") as f:
        f.write(
            """[Basic]
SceneCollection=vk-stream
Profile=vk-stream
"""
        )


def clear_safe_mode_flag():
    global_ini = os.path.join(OBS_HOME, "global.ini")
    os.makedirs(OBS_HOME, exist_ok=True)
    parser = configparser.ConfigParser()
    if os.path.exists(global_ini):
        parser.read(global_ini, encoding="utf-8")
    if "General" not in parser:
        parser["General"] = {}
    parser["General"]["UncleanShutdown"] = "false"
    if "Basic" not in parser:
        parser["Basic"] = {}
    parser["Basic"]["SceneCollection"] = "vk-stream"
    parser["Basic"]["Profile"] = "vk-stream"
    with open(global_ini, "w", encoding="utf-8") as file:
        parser.write(file)


def load_match_state() -> Dict[str, Any]:
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT state FROM football_match_state WHERE id = 1")
            row = cur.fetchone()
            return row[0] if row else {}


def save_match_state(state: Dict[str, Any]):
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE football_match_state SET state = %s WHERE id = 1",
                (json.dumps(state),),
            )
        conn.commit()


def deep_merge(base: Dict[str, Any], patch: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = deep_merge(out[key], value)
        else:
            out[key] = value
    return out


@app.get("/status")
def status():
    return jsonify({"status": "ok", "streaming": is_alive(obs_process)})


@app.post("/start")
def start_stream():
    global xvfb_process, obs_process
    with _stream_lock:
        if is_alive(obs_process):
            return jsonify({"status": "ok", "streaming": True})

        channel = read_active_channel()
        if not channel:
            return jsonify({"error": "Нет активного VK-канала"}), 400

        ensure_obs_files(channel)
        clear_safe_mode_flag()

        if not is_alive(xvfb_process):
            xvfb_process = subprocess.Popen(
                ["Xvfb", XVFB_DISPLAY, "-screen", "0", "1920x1080x24", "-nocursor"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            time.sleep(2)

        env = os.environ.copy()
        env["DISPLAY"] = XVFB_DISPLAY
        env["LIBGL_ALWAYS_SOFTWARE"] = "1"
        obs_process = subprocess.Popen(
            [
                "obs",
                "--startstreaming",
                "--minimize-to-tray",
                "--collection",
                "vk-stream",
                "--profile",
                "vk-stream",
            ],
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return jsonify({"status": "ok", "streaming": True})


@app.post("/stop")
def stop_stream():
    global xvfb_process, obs_process
    with _stream_lock:
        if is_alive(obs_process):
            obs_process.terminate()
            try:
                obs_process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                obs_process.kill()
        obs_process = None

        if is_alive(xvfb_process):
            xvfb_process.send_signal(signal.SIGTERM)
            try:
                xvfb_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                xvfb_process.kill()
        xvfb_process = None

        return jsonify({"status": "ok", "streaming": False})


@app.post("/overlay/update")
def overlay_update():
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return jsonify({"error": "invalid payload"}), 400
    current = load_match_state()
    updated = deep_merge(current, body)
    save_match_state(updated)
    return jsonify({"status": "ok"})


@app.post("/score")
def score_legacy():
    body = request.get_json(silent=True) or {}
    team = body.get("team")
    delta = int(body.get("delta", 1))
    if team not in ("team1", "team2"):
        return jsonify({"error": "team must be team1 or team2"}), 400
    current = load_match_state()
    score = current.get("score", {"team1": 0, "team2": 0})
    new_score = max(0, int(score.get(team, 0)) + delta)
    score[team] = new_score
    current["score"] = score
    save_match_state(current)
    return jsonify({"status": "ok", "score": score})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=API_PORT)
