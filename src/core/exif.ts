/**
 * When a photo was taken, read from the EXIF block at the start of a JPEG file
 * (DateTimeOriginal, or DateTime when that is missing). Only the first bytes of
 * the file are needed – see EXIF_BYTES.
 */

/** The EXIF block sits in the first segment of a JPEG and is at most 64 KB. */
export const EXIF_BYTES = 128 * 1024;

const DATE_TIME = 0x0132;
const EXIF_IFD = 0x8769;
const DATE_TIME_ORIGINAL = 0x9003;

/** "2024:07:15 18:30:05" (local time of the camera) → ms since 1970, or undefined. */
export function parseExifDate(s: string): number | undefined {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (!m) return undefined;
  const [y, mo, d, h, mi, se] = m.slice(1).map(Number) as [number, number, number, number, number, number];
  if (y < 1900 || mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  return new Date(y, mo - 1, d, h, mi, se).getTime();
}

/** The date the photo was taken, or undefined when the file has no (readable) EXIF date. */
export function exifDate(buf: ArrayBuffer): number | undefined {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return undefined;
  let p = 2;
  while (p + 4 <= v.byteLength) {
    const marker = v.getUint16(p);
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return undefined; // start of image data – no EXIF before it
    const len = v.getUint16(p + 2);
    if (marker === 0xffe1 && p + 10 <= v.byteLength && v.getUint32(p + 4) === 0x45786966 /* "Exif" */) {
      return readTiff(v, p + 10, Math.min(v.byteLength, p + 2 + len));
    }
    p += 2 + len;
  }
  return undefined;
}

function readTiff(v: DataView, start: number, end: number): number | undefined {
  if (start + 8 > end) return undefined;
  const order = v.getUint16(start);
  if (order !== 0x4949 && order !== 0x4d4d) return undefined;
  const le = order === 0x4949;
  const u16 = (o: number) => (o + 2 <= end ? v.getUint16(o, le) : 0);
  const u32 = (o: number) => (o + 4 <= end ? v.getUint32(o, le) : 0);

  /** Tag → value offset (relative to the TIFF start) for the tags we care about. */
  const entries = (ifd: number): Map<number, { type: number; count: number; at: number }> => {
    const out = new Map<number, { type: number; count: number; at: number }>();
    const base = start + ifd;
    const n = u16(base);
    for (let i = 0; i < n; i++) {
      const e = base + 2 + i * 12;
      if (e + 12 > end) break;
      out.set(u16(e), { type: u16(e + 2), count: u32(e + 4), at: e + 8 });
    }
    return out;
  };

  const ascii = (e: { type: number; count: number; at: number } | undefined): string | undefined => {
    if (!e || e.type !== 2) return undefined;
    const at = e.count > 4 ? start + u32(e.at) : e.at;
    if (at + e.count > end) return undefined;
    let s = '';
    for (let i = 0; i < e.count; i++) {
      const c = v.getUint8(at + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  };

  const ifd0 = entries(u32(start + 4));
  const exifPtr = ifd0.get(EXIF_IFD);
  const original = exifPtr ? ascii(entries(u32(exifPtr.at)).get(DATE_TIME_ORIGINAL)) : undefined;
  const date = original ?? ascii(ifd0.get(DATE_TIME));
  return date ? parseExifDate(date) : undefined;
}
