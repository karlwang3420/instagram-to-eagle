"""Prepare transparent extension icons from the supplied square artwork.

Usage: python tools/build_icons.py path/to/original.png
Requires Pillow, NumPy, and SciPy. The white glyphs are retained; only the
near-white exterior connected to the tile edge is made transparent.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def main(source: Path) -> None:
    rgb = np.asarray(Image.open(source).convert("RGB"), dtype=np.float32)
    if rgb.shape[0] != rgb.shape[1]:
        raise ValueError("Icon source must be square")

    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    colored = (chroma > 18) & (rgb.min(axis=2) < 240)
    labels, count = ndimage.label(colored)
    if not count:
        raise ValueError("No colored icon tile found")
    largest = np.argmax(np.bincount(labels.ravel())[1:]) + 1
    tile = ndimage.binary_fill_holes(labels == largest)

    # Infer the antialiased alpha at the outside edge from the neighboring
    # opaque gradient. This avoids carrying the original white matte into PNG.
    core = ndimage.binary_erosion(tile, iterations=3)
    nearby = ndimage.binary_dilation(tile, iterations=4)
    nearest = ndimage.distance_transform_edt(~core, return_distances=False,
                                             return_indices=True)
    foreground = rgb[tuple(nearest)]
    white = np.array([254.0, 254.0, 254.0], dtype=np.float32)
    delta = foreground - white
    fit = np.sum((rgb - white) * delta, axis=2) / np.maximum(
        np.sum(delta * delta, axis=2), 1.0
    )
    alpha = np.where(core, 1.0, np.where(nearby, fit, 0.0))
    alpha = np.where(alpha < 0.05, 0.0, np.clip(alpha, 0.0, 1.0))

    clean_rgb = np.where((alpha < 0.995)[..., None], foreground, rgb)
    rgba = np.dstack((clean_rgb, alpha * 255)).clip(0, 255).astype(np.uint8)
    master = Image.fromarray(rgba, "RGBA")
    target = Path(__file__).resolve().parent.parent / "icons"
    target.mkdir(exist_ok=True)
    for size in (16, 32, 48, 96, 128):
        resized = np.asarray(master.resize((size, size), Image.Resampling.LANCZOS)).copy()
        resized[resized[:, :, 3] < 8] = 0
        Image.fromarray(resized, "RGBA").save(target / f"icon-{size}.png",
                                             optimize=True)
    print(f"Wrote 16, 32, 48, 96, 128 px icons to {target}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
