import { MAX_PHOTO_BYTES } from './constants';

/** Sisi terpanjang foto setelah dikompres (px). Cukup tajam untuk layar penuh. */
export const PHOTO_MAX_SIDE = 1600;
const QUALITY = 0.8;
const STORED_TYPES = /^image\/(jpeg|png|webp)$/;

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/** Foto profil: dipotong persegi (bagian yang dipilih member, atau tengah foto), 512 × 512 px (±20–60 KB). */
export const AVATAR_SIDE = 512;
/** Batas bucket "avatars" (lihat supabase/tahap4-profil.sql). */
const AVATAR_MAX_BYTES = 1024 * 1024;

/**
 * Memperkecil foto di browser sebelum diunggah: sisi terpanjang maks. 1600 px
 * (atau persegi `square` px untuk foto profil, dari kotak `crop` dalam piksel foto asli),
 * WebP (atau JPEG bila browser tidak bisa membuat WebP), arah foto mengikuti EXIF.
 * Foto ponsel ±3 MB biasanya menjadi ±200–400 KB. Bila hasilnya tidak lebih kecil,
 * file asli dipakai (asal formatnya diterima penyimpanan).
 */
export type Crop = { x: number; y: number; size: number };

export async function compressPhoto(file: File, { square, crop }: { square?: number; crop?: Crop } = {}): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    if (STORED_TYPES.test(file.type) && file.size <= (square ? AVATAR_MAX_BYTES : MAX_PHOTO_BYTES)) return file;
    throw new Error('photo-unreadable');
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('photo-unreadable');
  if (square) {
    const side = Math.min(bitmap.width, bitmap.height);
    const c = crop ?? { x: (bitmap.width - side) / 2, y: (bitmap.height - side) / 2, size: side };
    canvas.width = canvas.height = Math.round(Math.min(square, c.size));
    ctx.drawImage(bitmap, c.x, c.y, c.size, c.size, 0, 0, canvas.width, canvas.height);
  } else {
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  }
  bitmap.close();

  let out = await toBlob(canvas, 'image/webp');
  // Safari lama mengembalikan PNG bila WebP tidak didukung.
  if (!out || out.type !== 'image/webp') out = await toBlob(canvas, 'image/jpeg');
  if (!out) throw new Error('photo-unreadable');

  // Foto profil selalu memakai hasil potongan persegi.
  const originalOk = !square && STORED_TYPES.test(file.type) && file.size <= MAX_PHOTO_BYTES;
  if (originalOk && file.size <= out.size) return file;
  if (out.size > (square ? AVATAR_MAX_BYTES : MAX_PHOTO_BYTES)) throw new Error('photo-too-large');
  return out;
}
