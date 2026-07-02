#!/usr/bin/env python3
"""
ep01 图生视频 — 需 fal.ai API Key

用法:
  export FAL_KEY=你的key
  pip install fal-client
  python3 build_i2v_fal.py

模型: wan v2.7 image-to-video（约 $0.15/秒 1080p）
4镜 × 3~5秒 ≈ $2-3/条
"""
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
KEYFRAMES = ROOT / "关键帧"
CLIPS = ROOT / "成片" / "i2v_clips"
OUT = ROOT / "成片"

SHOTS = [
    {
        "id": "shot01",
        "img": "shot01.png",
        "dur": "5",
        "prompt": (
            "chibi 3D yellow capybara girl pink bow pink dress angrily pointing finger, "
            "then hand putting red white milk can into open fridge, warm kitchen, "
            "subtle camera push-in, cartoon animation style, smooth motion"
        ),
    },
    {
        "id": "shot02",
        "img": "shot02.png",
        "dur": "5",
        "prompt": (
            "chibi 3D yellow capybara boy guilty holding burnt steak plate, "
            "girl angry hands on hips, slight character breathing motion, kitchen scene"
        ),
    },
    {
        "id": "shot03",
        "img": "shot03.png",
        "dur": "5",
        "prompt": (
            "chibi 3D yellow capybara boy opening fridge door slowly, "
            "eyes softening seeing milk can on shelf, gentle emotional motion, warm light"
        ),
    },
    {
        "id": "shot04",
        "img": "shot04.png",
        "dur": "5",
        "prompt": (
            "chibi 3D capybara couple in kitchen, girl turned away blushing, "
            "boy holding milk can small smug smile, cozy subtle movement"
        ),
    },
]

MODEL = "fal-ai/wan/v2.7/image-to-video"


def main():
    if not os.environ.get("FAL_KEY"):
        print("❌ 需要设置环境变量 FAL_KEY")
        print("   注册 https://fal.ai → API Keys → export FAL_KEY=xxx")
        sys.exit(1)
    try:
        import fal_client
    except ImportError:
        print("请先安装: pip install fal-client")
        sys.exit(1)

    CLIPS.mkdir(parents=True, exist_ok=True)
    results = []

    for shot in SHOTS:
        img_path = KEYFRAMES / shot["img"]
        print(f"\n=== 生成 {shot['id']} ===")
        url = fal_client.upload_file(str(img_path))
        out = fal_client.subscribe(
            MODEL,
            arguments={
                "image_url": url,
                "prompt": shot["prompt"],
                "resolution": "1080p",
                "duration": shot["dur"],
                "enable_prompt_expansion": True,
            },
            with_logs=True,
        )
        video_url = out["video"]["url"]
        clip_path = CLIPS / f"{shot['id']}.mp4"
        subprocess.run(["curl", "-sL", video_url, "-o", str(clip_path)], check=True)
        results.append({"id": shot["id"], "clip": str(clip_path), "url": video_url})
        print(f"✅ {clip_path}")

    (CLIPS / "manifest.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2)
    )
    print(f"\n✅ 4段动画已保存到 {CLIPS}/")
    print("下一步: 在剪映导入各 clip，按时间轴裁剪拼接，叠加配音稿.txt")


if __name__ == "__main__":
    main()
