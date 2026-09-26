#!/usr/bin/env python3
"""
Regenerate the PWA icons referenced by frontend/public/manifest.json and by
the service worker's push handler.

    python scripts/generate_icons.py

Requires Pillow (a build-time-only tool, not a frontend dependency):

    pip install pillow

The icons are committed to the repo, so you only need to run this when the
brand colour or the icon artwork changes.
"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT_DIR = Path(__file__).resolve().parent.parent / "public"

BG_TOP = (124, 58, 237)      # --brand purple, matches manifest theme_color
BG_BOTTOM = (76, 29, 149)    # deeper purple for a subtle vertical gradient
SHIELD = (255, 255, 255)
ACCENT = (251, 191, 36)      # amber, matches the app's "golden" accent


def rounded_mask(size: int, radius_ratio: float = 0.22) -> Image.Image:
    """Anti-aliased rounded-square mask so the icon is not a hard square."""
    scale = 4
    big = size * scale
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, big - 1, big - 1], radius=int(big * radius_ratio), fill=255
    )
    return mask.resize((size, size), Image.LANCZOS)


def gradient(size: int) -> Image.Image:
    base = Image.new("RGB", (1, size))
    pixels = base.load()
    for y in range(size):
        t = y / max(size - 1, 1)
        pixels[0, y] = tuple(
            round(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t) for i in range(3)
        )
    return base.resize((size, size), Image.BILINEAR)


def shield_points(size: int):
    """Shield outline, inset and scaled to the icon box."""
    cx = size / 2
    top = size * 0.20
    bottom = size * 0.80
    half_width = size * 0.26

    return [
        (cx, top),                              # top centre
        (cx + half_width, top + size * 0.10),   # top right shoulder
        (cx + half_width, top + size * 0.34),   # right side
        (cx, bottom),                           # bottom tip
        (cx - half_width, top + size * 0.34),   # left side
        (cx - half_width, top + size * 0.10),   # top left shoulder
    ]


def draw_check(draw: ImageDraw.ImageDraw, size: int) -> None:
    """Amber tick inside the shield, drawn as a thick polyline."""
    cx = size / 2
    cy = size * 0.47
    arm = size * 0.085
    draw.line(
        [
            (cx - arm * 1.5, cy),
            (cx - arm * 0.35, cy + arm),
            (cx + arm * 1.7, cy - arm * 1.15),
        ],
        fill=ACCENT,
        width=max(int(size * 0.055), 3),
        joint="curve",
    )


def build_icon(size: int) -> Image.Image:
    scale = 4
    canvas = gradient(size).convert("RGBA")

    # Draw the artwork oversampled, then downscale for clean edges.
    big = Image.new("RGBA", (size * scale, size * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(big)
    draw.polygon(shield_points(size * scale), fill=SHIELD + (255,))
    draw_check(draw, size * scale)

    big = big.resize((size, size), Image.LANCZOS)
    canvas.alpha_composite(big)

    # Apply the rounded-square mask.
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(canvas, (0, 0), canvas)
    out.putalpha(rounded_mask(size))
    return out


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for size, name in ((192, "icon-192.png"), (512, "icon-512.png")):
        path = OUT_DIR / name
        build_icon(size).save(path, "PNG", optimize=True)
        print(f"wrote {path} ({path.stat().st_size} bytes)")

    # Apple touch icon so iOS home-screen installs do not fall back to a screenshot.
    touch = OUT_DIR / "apple-touch-icon.png"
    build_icon(180).convert("RGB").save(touch, "PNG", optimize=True)
    print(f"wrote {touch} ({touch.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
