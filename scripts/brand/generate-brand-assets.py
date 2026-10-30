#!/usr/bin/env python3
"""Generate every GetANNY brand asset from the supplied original artwork.

The source files in assets/brand/source/ are the untouched official PNGs
(eagle/shield symbol, wordmark and the two lockups).  This script never
redraws, traces, distorts or crops the artwork: it only

  * rebuilds transparency from the original alpha channel (black ink on a
    transparent canvas), keeping the original antialiased edges,
  * recolours the ink for light, dark and icon-tile surfaces,
  * pads the canvas proportionally, and
  * resamples with Lanczos into the required sizes.

Requires Pillow:  python -m pip install pillow
Run from the repository root:  python scripts/brand/generate-brand-assets.py
"""

from __future__ import annotations

import struct
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "brand" / "source"
BRAND = ROOT / "assets" / "brand"
ASSETS = ROOT / "assets"
PUBLIC = ROOT / "public"
EXTENSION_ICONS = ROOT / "src" / "extension" / "icons"

INK = (0, 0, 0)
PAPER = (255, 255, 255)
TILE = (12, 14, 17)
TILE_RIM = (43, 48, 56)

ICO_SIZES = (16, 24, 32, 48, 64, 128, 256)
PNG_SIZES = (16, 24, 32, 48, 64, 128, 256, 512, 1024)


def ink_alpha(image: Image.Image) -> Image.Image:
    """Return the artwork's coverage as an 8-bit alpha channel.

    The supplied files are black ink composited on transparency, so the
    antialiased coverage is 255 - luminance.  Taking the stronger of that
    and the stored alpha keeps every original edge detail and removes the
    faint noise pixels in the transparent margin.
    """
    rgba = image.convert("RGBA")
    luminance = rgba.convert("L")
    stored = rgba.getchannel("A")
    alpha = Image.new("L", rgba.size)
    alpha.putdata(
        [
            max(0, min(255, max(a, 255 - l)))
            for a, l in zip(stored.getdata(), luminance.getdata())
        ]
    )
    alpha.putdata([0 if value < 4 else value for value in alpha.getdata()])
    return alpha


def load_ink(path: Path) -> Image.Image:
    """Load a source file and return a trimmed, padded RGBA ink layer."""
    alpha = ink_alpha(Image.open(path))
    bounds = alpha.point(lambda value: 255 if value > 24 else 0).getbbox()
    if not bounds:
        raise SystemExit(f"No artwork found in {path}")
    return alpha.crop(bounds)


def colorize(alpha: Image.Image, color: tuple[int, int, int]) -> Image.Image:
    layer = Image.new("RGBA", alpha.size, color + (0,))
    layer.putalpha(alpha)
    return layer


def padded(size: tuple[int, int], image: Image.Image, pad: float = 0.0) -> Image.Image:
    """Fit the artwork proportionally into a canvas, adding transparent padding."""
    width, height = size
    inner_w = max(1, round(width * (1 - 2 * pad)))
    inner_h = max(1, round(height * (1 - 2 * pad)))
    scale = min(inner_w / image.width, inner_h / image.height)
    target = (
        max(1, round(image.width * scale)),
        max(1, round(image.height * scale)),
    )
    resized = image.resize(target, Image.LANCZOS)
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    canvas.alpha_composite(
        resized, ((width - target[0]) // 2, (height - target[1]) // 2)
    )
    return canvas


def rounded_tile(size: int, mark: Image.Image, scale: float = 0.62) -> Image.Image:
    """App icon: the untouched eagle/shield in white on an obsidian tile."""
    tile = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(tile)
    radius = max(2, round(size * 0.22))
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=TILE + (255,))
    if size >= 48:
        draw.rounded_rectangle(
            (0, 0, size - 1, size - 1),
            radius=radius,
            outline=TILE_RIM + (255,),
            width=max(1, round(size / 128)),
        )
    white_mark = colorize(mark, PAPER)
    art = padded((size, size), white_mark, pad=(1 - scale) / 2)
    tile.alpha_composite(art)
    return tile


def write_ico(images: dict[int, Image.Image], path: Path) -> None:
    entries = []
    for size in ICO_SIZES:
        buffer = BytesIO()
        images[size].save(buffer, "PNG", optimize=True)
        entries.append((size, buffer.getvalue()))
    offset = 6 + 16 * len(entries)
    directory = b""
    payload = b""
    for size, data in entries:
        directory += struct.pack(
            "<BBBBHHII",
            0 if size == 256 else size,
            0 if size == 256 else size,
            0,
            0,
            1,
            32,
            len(data),
            offset,
        )
        offset += len(data)
        payload += data
    path.write_bytes(struct.pack("<HHH", 0, 1, len(entries)) + directory + payload)


def write_icns(images: dict[int, Image.Image], path: Path) -> None:
    types = {
        16: b"icp4",
        32: b"icp5",
        64: b"icp6",
        128: b"ic07",
        256: b"ic08",
        512: b"ic09",
        1024: b"ic10",
    }
    chunks = b""
    for size, kind in types.items():
        buffer = BytesIO()
        images[size].save(buffer, "PNG", optimize=True)
        data = buffer.getvalue()
        chunks += kind + struct.pack(">I", len(data) + 8) + data
    path.write_bytes(b"icns" + struct.pack(">I", len(chunks) + 8) + chunks)


def social_banner(size: tuple[int, int], lockup: Image.Image) -> Image.Image:
    canvas = Image.new("RGB", size, (10, 12, 15))
    white_lockup = colorize(lockup, PAPER)
    art = padded((round(size[0] * 0.82), round(size[1] * 0.82)), white_lockup)
    canvas.paste(art, ((size[0] - art.width) // 2, (size[1] - art.height) // 2), art)
    return canvas


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True)
    print(f"  {path.relative_to(ROOT).as_posix()}  {image.width}x{image.height}")


def main() -> None:
    BRAND.mkdir(parents=True, exist_ok=True)
    symbol = load_ink(SOURCE / "symbol.png")
    wordmark = load_ink(SOURCE / "wordmark.png")
    horizontal = load_ink(SOURCE / "lockup-horizontal.png")
    stacked = load_ink(SOURCE / "lockup-stacked.png")

    print("Monochrome masks and colour variants")
    for name, art, width in (
        ("symbol", symbol, 1024),
        ("wordmark", wordmark, 2048),
        ("lockup-horizontal", horizontal, 2400),
        ("lockup-stacked", stacked, 1200),
    ):
        for tone, color in (("white", PAPER), ("black", INK)):
            height = max(1, round(art.height * width / art.width))
            variant = colorize(art, color).resize((width, height), Image.LANCZOS)
            save(variant, BRAND / f"{name}-{tone}.png")

    print("Application icons")
    tiles = {
        size: rounded_tile(size, symbol) for size in sorted(set(PNG_SIZES + ICO_SIZES))
    }
    save(tiles[512], ASSETS / "icon.png")
    save(tiles[256], PUBLIC / "icon.png")
    save(tiles[256], BRAND / "app-icon-256.png")
    save(tiles[1024], BRAND / "app-icon-1024.png")
    write_ico(tiles, ASSETS / "icon.ico")
    print(f"  assets/icon.ico  {', '.join(f'{s}x{s}' for s in ICO_SIZES)}")
    write_icns(tiles, ASSETS / "icon.icns")
    print("  assets/icon.icns  16-1024")

    print("Tray icon (monochrome, transparent)")
    for size in (16, 20, 24, 32, 48):
        save(
            padded((size, size), colorize(symbol, PAPER), pad=0.06),
            BRAND / f"tray-icon-{size}.png",
        )
    save(padded((32, 32), colorize(symbol, PAPER), pad=0.06), ASSETS / "tray-icon.png")

    print("Browser extension icons")
    for size in (16, 48, 128):
        save(tiles[size], EXTENSION_ICONS / f"icon{size}.png")
    extension_wordmark = colorize(wordmark, PAPER).resize(
        (640, max(1, round(wordmark.height * 640 / wordmark.width))), Image.LANCZOS
    )
    save(extension_wordmark, EXTENSION_ICONS / "wordmark.png")

    print("Installer artwork")
    header = Image.new("RGB", (150, 57), (255, 255, 255))
    header_mark = padded((34, 34), colorize(symbol, INK), pad=0.02)
    header.paste(header_mark, (6, 11), header_mark)
    header_wordmark = padded((96, 26), colorize(wordmark, INK), pad=0.02)
    header.paste(header_wordmark, (46, 16), header_wordmark)
    header.save(ASSETS / "installerHeader.bmp", "BMP")
    print("  assets/installerHeader.bmp  150x57")

    sidebar = Image.new("RGB", (164, 314), (255, 255, 255))
    sidebar_mark = padded((104, 104), colorize(symbol, INK), pad=0.02)
    sidebar.paste(sidebar_mark, (30, 74), sidebar_mark)
    sidebar_wordmark = padded((124, 24), colorize(wordmark, INK), pad=0.02)
    sidebar.paste(sidebar_wordmark, (20, 190), sidebar_wordmark)
    sidebar.save(ASSETS / "installerSidebar.bmp", "BMP")
    print("  assets/installerSidebar.bmp  164x314")

    print("Documentation banner")
    banner = social_banner((1600, 500), horizontal)
    banner.save(ASSETS / "logo.jpg", "JPEG", quality=92, optimize=True)
    banner.save(PUBLIC / "logo.jpg", "JPEG", quality=92, optimize=True)
    print("  assets/logo.jpg / public/logo.jpg  1600x500")


if __name__ == "__main__":
    main()
