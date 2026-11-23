/*
 * Geometry for positioning a photo inside a fixed-ratio frame (the 3:1 cover editor).
 * A view is the image point shown at the frame's centre (cx, cy, in image pixels) plus a zoom
 * (1 = the smallest size that still fills the frame). Because it's stored in image pixels, the
 * same view survives the frame being resized.
 */

export interface CropView {
  cx: number;
  cy: number;
  zoom: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/** Display scale (screen px per image px) for a frame `fw` x `fh`. */
export function scaleFor(iw: number, ih: number, fw: number, fh: number, zoom: number): number {
  return Math.max(fw / iw, fh / ih) * zoom;
}

/** Keep the zoom in range and the frame fully covered by the image (no empty edges). */
export function clampView(v: CropView, iw: number, ih: number, fw: number, fh: number): CropView {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom));
  const s = scaleFor(iw, ih, fw, fh, zoom);
  const hw = fw / s / 2;
  const hh = fh / s / 2;
  const clamp = (n: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, n)));
  return { zoom, cx: clamp(v.cx, hw, iw - hw), cy: clamp(v.cy, hh, ih - hh) };
}

/** The starting view: centred, filling the frame. */
export function initialView(iw: number, ih: number): CropView {
  return { cx: iw / 2, cy: ih / 2, zoom: 1 };
}

/** Move by a drag of (dx, dy) screen px. */
export function panBy(v: CropView, dx: number, dy: number, iw: number, ih: number, fw: number, fh: number): CropView {
  const s = scaleFor(iw, ih, fw, fh, v.zoom);
  return clampView({ ...v, cx: v.cx - dx / s, cy: v.cy - dy / s }, iw, ih, fw, fh);
}

/** Change zoom keeping the image point under (px, py) (frame coords; default the centre) where it is. */
export function zoomTo(v: CropView, zoom: number, iw: number, ih: number, fw: number, fh: number, px = fw / 2, py = fh / 2): CropView {
  const s0 = scaleFor(iw, ih, fw, fh, v.zoom);
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
  const s1 = scaleFor(iw, ih, fw, fh, z);
  const ax = v.cx + (px - fw / 2) / s0;
  const ay = v.cy + (py - fh / 2) / s0;
  return clampView({ zoom: z, cx: ax - (px - fw / 2) / s1, cy: ay - (py - fh / 2) / s1 }, iw, ih, fw, fh);
}

/** Where to draw the image inside the frame (top-left and size, in screen px). */
export function layout(v: CropView, iw: number, ih: number, fw: number, fh: number) {
  const s = scaleFor(iw, ih, fw, fh, v.zoom);
  return { left: fw / 2 - v.cx * s, top: fh / 2 - v.cy * s, width: iw * s, height: ih * s };
}

/** The part of the image the frame shows, in image px, for drawing the final crop. Independent of frame size. */
export function cropRect(v: CropView, iw: number, ih: number, ratio: number) {
  // Any frame with the right ratio gives the same rectangle; use one unit high.
  const s = scaleFor(iw, ih, ratio, 1, v.zoom);
  const sw = ratio / s;
  const sh = 1 / s;
  return { sx: v.cx - sw / 2, sy: v.cy - sh / 2, sw, sh };
}
