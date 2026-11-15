import { describe, expect, it } from 'vitest';
import { crc32, zipParts } from '../../src/core/zip';

const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

describe('zip', () => {
  it('computes CRC-32', () => {
    expect(crc32(new TextEncoder().encode('hello'))).toBe(0x3610a686);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('writes stored entries readable through the central directory', () => {
    const enc = new TextEncoder();
    const files = [
      { name: 'kolaz_001.jpg', data: enc.encode('first') },
      { name: 'kolaż_002.jpg', data: enc.encode('second!') },
    ];
    const zip = concat(zipParts(files, new Date(2026, 10, 15, 12, 0, 0)));
    const v = new DataView(zip.buffer);
    const end = zip.length - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    expect(v.getUint16(end + 10, true)).toBe(2);
    let p = v.getUint32(end + 16, true);
    const dec = new TextDecoder();
    for (const f of files) {
      expect(v.getUint32(p, true)).toBe(0x02014b50);
      const nameLen = v.getUint16(p + 28, true);
      expect(dec.decode(zip.subarray(p + 46, p + 46 + nameLen))).toBe(f.name);
      const local = v.getUint32(p + 42, true);
      expect(v.getUint32(local, true)).toBe(0x04034b50);
      const size = v.getUint32(local + 18, true);
      const start = local + 30 + v.getUint16(local + 26, true);
      expect(dec.decode(zip.subarray(start, start + size))).toBe(dec.decode(f.data));
      expect(v.getUint32(local + 14, true)).toBe(crc32(f.data));
      p += 46 + nameLen;
    }
  });
});
