import { describe, expect, it } from 'vitest';
import { exifDate, parseExifDate } from '../../src/core/exif';

/** A JPEG start with an EXIF block: IFD0 (DateTime, pointer to the Exif IFD) and the Exif IFD (DateTimeOriginal). */
function jpegWithExif(opts: { little: boolean; original?: string; dateTime?: string }): ArrayBuffer {
  const tiff: number[] = [];
  const le = opts.little;
  const u16 = (v: number) => (le ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  const u32 = (v: number) => (le ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24] : [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]);
  const str = (s: string) => [...s].map((c) => c.charCodeAt(0)).concat(0);
  // Layout: header(8) | IFD0 at 8: count(2) + 2 entries(24) + next(4) = 30 → 38 | Exif IFD at 38: 2 + 12 + 4 = 18 → 56 | strings
  const ifd0 = 8;
  const exifIfd = 38;
  const dtAt = 56;
  const origAt = 76;
  tiff.push(...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(ifd0));
  tiff.push(...u16(2));
  tiff.push(...u16(0x0132), ...u16(2), ...u32(20), ...u32(dtAt));
  tiff.push(...u16(0x8769), ...u16(4), ...u32(1), ...u32(exifIfd));
  tiff.push(...u32(0));
  tiff.push(...u16(opts.original ? 1 : 0));
  if (opts.original) tiff.push(...u16(0x9003), ...u16(2), ...u32(20), ...u32(origAt));
  else tiff.push(...Array.from({ length: 12 }, () => 0));
  tiff.push(...u32(0));
  while (tiff.length < dtAt) tiff.push(0);
  tiff.push(...str(opts.dateTime ?? '2000:01:01 00:00:00'));
  while (tiff.length < origAt) tiff.push(0);
  if (opts.original) tiff.push(...str(opts.original));
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const bytes = [0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xe1, (app1.length + 2) >> 8, (app1.length + 2) & 0xff, ...app1, 0xff, 0xda];
  return new Uint8Array(bytes).buffer;
}

describe('exifDate', () => {
  it('reads DateTimeOriginal (both byte orders)', () => {
    const want = new Date(2024, 6, 15, 18, 30, 5).getTime();
    expect(exifDate(jpegWithExif({ little: true, original: '2024:07:15 18:30:05' }))).toBe(want);
    expect(exifDate(jpegWithExif({ little: false, original: '2024:07:15 18:30:05' }))).toBe(want);
  });

  it('falls back to DateTime', () => {
    expect(exifDate(jpegWithExif({ little: true, dateTime: '2019:12:31 23:59:58' }))).toBe(new Date(2019, 11, 31, 23, 59, 58).getTime());
  });

  it('gives nothing for files without EXIF or broken data', () => {
    expect(exifDate(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBeUndefined();
    expect(exifDate(new Uint8Array([0xff, 0xd8, 0xff, 0xda]).buffer)).toBeUndefined();
    expect(exifDate(jpegWithExif({ little: true, original: 'garbage' }).slice(0, 40))).toBeUndefined();
    expect(exifDate(new ArrayBuffer(0))).toBeUndefined();
  });
});

describe('parseExifDate', () => {
  it('rejects empty camera dates', () => {
    expect(parseExifDate('0000:00:00 00:00:00')).toBeUndefined();
    expect(parseExifDate('')).toBeUndefined();
  });
});
