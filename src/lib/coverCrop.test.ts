import { describe, expect, it } from 'vitest';
import { clampView, cropRect, initialView, layout, MAX_ZOOM, panBy, zoomTo } from './coverCrop';

// A 4000 x 3000 photo in a 900 x 300 (3:1) frame.
const IW = 4000;
const IH = 3000;
const FW = 900;
const FH = 300;

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('cover crop', () => {
  it('starts centred and fills the frame width (landscape-ish photo)', () => {
    const v = initialView(IW, IH);
    const l = layout(v, IW, IH, FW, FH);
    close(l.width, FW); // width-limited: 4000 -> 900
    close(l.left, 0);
    expect(l.top).toBeLessThan(0); // extra height above and below
    close(l.top + l.height / 2, FH / 2); // centred vertically
  });

  it('crop is 3:1 and inside the image', () => {
    const r = cropRect(initialView(IW, IH), IW, IH, 3);
    close(r.sw / r.sh, 3);
    close(r.sw, IW);
    expect(r.sy).toBeGreaterThanOrEqual(0);
    expect(r.sy + r.sh).toBeLessThanOrEqual(IH);
  });

  it('dragging moves the view and stops at the edges', () => {
    const v = initialView(IW, IH);
    // Drag the photo down by 20px: the frame now shows a higher part of the photo.
    const down = panBy(v, 0, 20, IW, IH, FW, FH);
    expect(down.cy).toBeLessThan(v.cy);
    // Drag far down: clamps so the photo's top edge meets the frame's top edge.
    const top = panBy(v, 0, 100000, IW, IH, FW, FH);
    close(layout(top, IW, IH, FW, FH).top, 0);
    // Drag far up: bottom edges meet.
    const bottom = panBy(v, 0, -100000, IW, IH, FW, FH);
    const lb = layout(bottom, IW, IH, FW, FH);
    close(lb.top + lb.height, FH);
    // At zoom 1 the width exactly fits, so sideways drags do nothing.
    close(panBy(v, 500, 0, IW, IH, FW, FH).cx, v.cx);
  });

  it('zooming keeps the point under the cursor in place', () => {
    const v = initialView(IW, IH);
    const px = 200;
    const py = 100;
    const before = layout(v, IW, IH, FW, FH);
    const imgX = (px - before.left) / (before.width / IW);
    const imgY = (py - before.top) / (before.height / IH);
    const z = zoomTo(v, 2, IW, IH, FW, FH, px, py);
    const after = layout(z, IW, IH, FW, FH);
    close(after.left + imgX * (after.width / IW), px);
    close(after.top + imgY * (after.height / IH), py);
  });

  it('zoom is limited and never leaves empty space', () => {
    const v = zoomTo(initialView(IW, IH), 99, IW, IH, FW, FH);
    expect(v.zoom).toBe(MAX_ZOOM);
    const out = zoomTo(v, 0.1, IW, IH, FW, FH);
    expect(out.zoom).toBe(1);
    const l = layout(clampView({ cx: -5000, cy: 99999, zoom: 3 }, IW, IH, FW, FH), IW, IH, FW, FH);
    expect(l.left).toBeLessThanOrEqual(1e-9);
    expect(l.top).toBeLessThanOrEqual(1e-9);
    expect(l.left + l.width).toBeGreaterThanOrEqual(FW - 1e-9);
    expect(l.top + l.height).toBeGreaterThanOrEqual(FH - 1e-9);
  });

  it('the crop does not depend on the on-screen frame size', () => {
    const v = panBy(zoomTo(initialView(IW, IH), 2.5, IW, IH, FW, FH, 300, 50), 40, -30, IW, IH, FW, FH);
    const a = cropRect(v, IW, IH, 3);
    // Same view shown in a smaller frame (e.g. on a phone) must save the same pixels.
    const small = clampView(v, IW, IH, 360, 120);
    const b = cropRect(small, IW, IH, 3);
    close(a.sx, b.sx);
    close(a.sy, b.sy);
    close(a.sw, b.sw);
  });

  it('a very wide panorama is height-limited and can slide sideways', () => {
    const W = 6000;
    const H = 1000; // 6:1
    const v = initialView(W, H);
    const l = layout(v, W, H, FW, FH);
    close(l.height, FH);
    const moved = panBy(v, -100, 0, W, H, FW, FH);
    expect(moved.cx).toBeGreaterThan(v.cx);
  });
});
