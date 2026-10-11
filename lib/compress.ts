import { MAX_PHOTO_BYTES } from './constants';

/** Sisi terpanjang foto setelah dikompres (px). Cukup tajam untuk layar penuh. */
export const PHOTO_MAX_SIDE = 1600;
const QUALITY = 0.8;
const STORED_TYPES = /^image\/(jpeg|png|webp)$/;

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/**
 * Memperkecil foto di browser sebelum diunggah: sisi terpanjang maks. 1600 px,
 * WebP (atau JPEG bila browser tidak bisa membuat WebP), arah foto mengikuti EXIF.
 * Foto ponsel ±3 MB biasanya menjadi ±200–400 KB. Bila hasilnya tidak lebih kecil,
 * file asli dipakai (asal formatnya diterima penyimpanan).
 */
export async function compressPhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    if (STORED_TYPES.test(file.type) && file.size <= MAX_PHOTO_BYTES) return file;
    throw new Error('photo-unreadable');
  }
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('photo-unreadable');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let out = await toBlob(canvas, 'image/webp');
  // Safari lama mengembalikan PNG bila WebP tidak didukung.
  if (!out || out.type !== 'image/webp') out = await toBlob(canvas, 'image/jpeg');
  if (!out) throw new Error('photo-unreadable');

  const originalOk = STORED_TYPES.test(file.type) && file.size <= MAX_PHOTO_BYTES;
  if (originalOk && file.size <= out.size) return file;
  if (out.size > MAX_PHOTO_BYTES) throw new Error('photo-too-large');
  return out;
}
