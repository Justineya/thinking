#!/usr/bin/env python3
"""ep01 自动成片 — 关键帧 + 配音 + 字幕。支持静帧/运镜两种模式。"""
import argparse
import asyncio
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
KEYFRAMES = ROOT / "关键帧"
OUT = ROOT / "成片"
ETTS = "/home/ubuntu/.local/bin/edge-tts"

# 组合 A 映射（edge-tts 近似剪映阳光男孩/甜美女声）
VOICES = {
    "lumei": "zh-CN-XiaoyiNeural",   # 甜美/元气
    "lulu": "zh-CN-YunxiNeural",     # 阳光/稍憨
}

LINES = [
    {"id": "v01", "role": "lumei", "text": "你再碰厨房试试！", "rate": "+18%", "start": 0.2},
    {"id": "v02", "role": "lumei", "text": "连牛排都能煎焦？！", "rate": "+15%", "start": 3.2},
    {"id": "v03", "role": "lulu", "text": "……我本来可以的。", "rate": "-2%", "volume": "-15%", "start": 4.5},
    {"id": "v04", "role": "lumei", "text": "别乱翻，过期的我清掉了。", "rate": "+0%", "start": 9.0},
    {"id": "v05", "role": "lumei", "text": "超市买一送一，清库存而已，别多想。", "rate": "+0%", "start": 12.5},
]

SHOTS = [
    {"img": "shot01.png", "dur": 3.0, "motion": "zoom_in"},
    {"img": "shot02.png", "dur": 4.0, "motion": "pan_right"},
    {"img": "shot03.png", "dur": 5.0, "motion": "zoom_in_slow"},
    {"img": "shot04.png", "dur": 6.0, "motion": "zoom_out"},
]

SUBS = [
    (0.2, 2.8, "嘴上说让他滚"),
    (3.2, 6.8, "手上还在给他收拾烂摊子"),
    (14.0, 17.5, "她从来不会说对不起。但她会记得我爱喝什么。"),
]

W, H = 1080, 1920
TOTAL = 18.0


async def gen_tts():
    audio_dir = OUT / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    meta = []
    for line in LINES:
        out = audio_dir / f"{line['id']}.mp3"
        cmd = [
            ETTS,
            "--voice", VOICES[line["role"]],
            f"--rate={line.get('rate', '+0%')}",
            "--text", line["text"],
            "--write-media", str(out),
        ]
        if line.get("volume"):
            cmd.append(f"--volume={line['volume']}")
        proc = await asyncio.create_subprocess_exec(*cmd)
        await proc.wait()
        if proc.returncode != 0:
            raise RuntimeError(f"TTS failed: {line['id']}")
        dur = ffprobe_duration(out)
        meta.append({**line, "file": str(out), "duration": dur})
    (OUT / "audio_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2))
    return meta


def ffprobe_duration(path):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True,
    )
    return float(r.stdout.strip())


def run(cmd, **kw):
    print(">", " ".join(str(c) for c in cmd))
    subprocess.run(cmd, check=True, **kw)


def motion_filter(shot):
    """Ken Burns 运镜 — 无 API 时的轻量「动起来」方案"""
    fps = 30
    d = int(shot["dur"] * fps)
    base = f"scale=8000:-1,zoompan=s={W}x{H}:fps={fps}:d={d}"
    m = shot.get("motion", "zoom_in")
    if m == "zoom_in":
        z = f"z='min(1.0+0.002*on,1.25)'"
    elif m == "zoom_in_slow":
        z = f"z='min(1.0+0.001*on,1.15)'"
    elif m == "zoom_out":
        z = f"z='max(1.25-0.001*on,1.0)'"
    elif m == "pan_right":
        z = "z=1.15"
        x = f"x='(iw-iw/zoom)*on/{d}'"
        return f"{base}:{z}:{x}:y='(ih-ih/zoom)/2'"
    else:
        z = "z=1.1"
    return f"{base}:{z}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"


def build_video_segments(tmp, motion="static"):
    segs = []
    for i, shot in enumerate(SHOTS):
        inp = KEYFRAMES / shot["img"]
        seg = tmp / f"seg{i:02d}.mp4"
        if motion == "kenburns":
            vf = motion_filter(shot) + ",format=yuv420p"
        else:
            vf = (
                f"scale={W}:{H}:force_original_aspect_ratio=decrease,"
                f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=0xFFF5E6,"
                f"fps=30,format=yuv420p"
            )
        run([
            "ffmpeg", "-y", "-loop", "1", "-i", str(inp),
            "-t", str(shot["dur"]),
            "-vf", vf,
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            str(seg),
        ])
        segs.append(seg)
    concat_list = tmp / "concat.txt"
    concat_list.write_text("\n".join(f"file '{s}'" for s in segs))
    video_nosub = tmp / "video_nosub.mp4"
    run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", str(concat_list), "-c", "copy", str(video_nosub),
    ])
    return video_nosub


def build_audio_track(meta, tmp):
    """Mix voice lines at timeline positions with silence base."""
    # Generate silence base
    silence = tmp / "silence.mp3"
    run([
        "ffmpeg", "-y", "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=stereo",
        "-t", str(TOTAL), "-q:a", "9", str(silence),
    ])
    inputs = ["-i", str(silence)]
    filters = []
    for i, line in enumerate(meta):
        inputs.extend(["-i", line["file"]])
        ms = int(line["start"] * 1000)
        filters.append(f"[{i+1}:a]adelay={ms}|{ms}[a{i}]")
    mix_inputs = "[0:a]" + "".join(f"[a{i}]" for i in range(len(meta)))
    n = len(meta) + 1
    filters.append(f"{mix_inputs}amix=inputs={n}:duration=first:dropout_transition=0[aout]")
    audio_out = tmp / "voice_mix.mp3"
    run([
        "ffmpeg", "-y", *inputs,
        "-filter_complex", ";".join(filters),
        "-map", "[aout]", "-c:a", "libmp3lame", "-b:a", "192k",
        str(audio_out),
    ])
    return audio_out


def build_ass(tmp):
    ass = tmp / "subs.ass"
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,WenQuanYi Micro Hei,72,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,2,60,60,180,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    def ts(sec):
        h = int(sec // 3600)
        m = int((sec % 3600) // 60)
        s = sec % 60
        return f"{h}:{m:02d}:{s:05.2f}"

    events = []
    for start, end, text in SUBS:
        events.append(f"Dialogue: 0,{ts(start)},{ts(end)},Default,,0,0,0,,{text}")
    ass.write_text(header + "\n".join(events) + "\n", encoding="utf-8")
    return ass


def mux(video, audio, ass, out_path):
    # Burn subtitles + merge audio
    run([
        "ffmpeg", "-y",
        "-i", str(video),
        "-i", str(audio),
        "-vf", f"ass={ass}",
        "-c:v", "libx264", "-crf", "20", "-preset", "medium",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        str(out_path),
    ])


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--motion", choices=["static", "kenburns"], default="kenburns")
    parser.add_argument("--version", default="v02")
    args = parser.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    suffix = args.version if args.version else ("v02" if args.motion == "kenburns" else "v01")
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        print(f"=== 模式: {args.motion} → {suffix} ===")
        print("=== 1/4 生成配音 ===")
        meta = await gen_tts()
        print("=== 2/4 合成画面 ===")
        video = build_video_segments(tmp, motion=args.motion)
        print("=== 3/4 混音 ===")
        audio = build_audio_track(meta, tmp)
        ass = build_ass(tmp)
        print("=== 4/4 导出成片 ===")
        out = OUT / f"ep01_她从来不会说对不起_{suffix}.mp4"
        mux(video, audio, ass, out)
        print(f"\n✅ 成片: {out}")


if __name__ == "__main__":
    asyncio.run(main())
