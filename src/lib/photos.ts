import { db } from '../db';
import type { Photo } from '../types';

const FULL_MAX = 1600;
const THUMB_MAX = 420;

type Source = ImageBitmap | HTMLImageElement;

async function loadImage(file: Blob): Promise<Source> {
  if (typeof createImageBitmap === 'function') {
    try {
      // Respect EXIF rotation from phone cameras.
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall through to <img> decoding */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This image format is not supported. Try a JPEG or PNG.'));
    };
    img.src = url;
  });
}

function sizeOf(src: Source): [number, number] {
  return src instanceof HTMLImageElement ? [src.naturalWidth, src.naturalHeight] : [src.width, src.height];
}

async function encode(src: Source, max: number, quality: number): Promise<{ data: ArrayBuffer; width: number; height: number }> {
  const [w, h] = sizeOf(src);
  const scale = Math.min(1, max / Math.max(w, h));
  const width = Math.max(1, Math.round(w * scale));
  const height = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', quality),
  );
  return { data: await blob.arrayBuffer(), width, height };
}

/** Downscale + re-encode a photo so it stays small on the device. */
export async function processImage(file: Blob): Promise<Pick<Photo, 'type' | 'data' | 'thumb' | 'width' | 'height'>> {
  const src = await loadImage(file);
  const full = await encode(src, FULL_MAX, 0.85);
  const thumb = await encode(src, THUMB_MAX, 0.78);
  if ('close' in src) src.close();
  return { type: 'image/jpeg', data: full.data, thumb: thumb.data, width: full.width, height: full.height };
}

export async function savePhoto(date: string, file: Blob): Promise<void> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > 40 * 1024 * 1024) throw new Error('That image is too large (max 40 MB).');
  const processed = await processImage(file);
  const now = Date.now();
  const existing = await db.photos.get(date);
  await db.photos.put({ date, ...processed, createdAt: existing?.createdAt ?? now, updatedAt: now });
}

export function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function base64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
