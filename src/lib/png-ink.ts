import { inflateSync } from "node:zlib";

/**
 * How much was actually drawn on a signature canvas.
 *
 * The browser sends a PNG of the pad. An untouched pad is a fully transparent
 * image — but it is *not* a small file: a blank 979×160 canvas still encodes to
 * about 3.7KB, and on a phone with a 3× screen it is larger still. So judging
 * emptiness by file size accepts a blank signature, which is the one thing this
 * must never do.
 *
 * Counting the pixels that are not transparent is the only honest test, so this
 * decodes the PNG far enough to do that: header, deflate stream, undo the
 * per-row filter, look at the alpha channel. Only the shape a canvas actually
 * produces — 8-bit RGBA, no interlacing — is accepted; anything else is
 * reported as unreadable rather than guessed at.
 */
export function countInkPixels(png: Buffer): number | null {
  const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.length < 8) return null;
  for (let i = 0; i < SIGNATURE.length; i++) {
    if (png[i] !== SIGNATURE[i]) return null;
  }

  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  let offset = 8;

  while (offset + 8 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end > png.length) return null;

    if (type === "IHDR") {
      width = png.readUInt32BE(start);
      height = png.readUInt32BE(start + 4);
      const bitDepth = png[start + 8];
      const colourType = png[start + 9];
      const interlace = png[start + 12];
      // 6 is RGBA, which is what a canvas produces. Anything else — palette,
      // greyscale, 16-bit, interlaced — is not something to guess about.
      if (bitDepth !== 8 || colourType !== 6 || interlace !== 0) return null;
    } else if (type === "IDAT") {
      idat.push(png.subarray(start, end));
    } else if (type === "IEND") {
      break;
    }

    offset = end + 4; // skip the CRC
  }

  if (!width || !height || idat.length === 0) return null;

  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }

  const channels = 4;
  const stride = width * channels;
  if (raw.length < (stride + 1) * height) return null;

  const line = Buffer.alloc(stride);
  const previous = Buffer.alloc(stride);
  let ink = 0;

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const from = y * (stride + 1) + 1;

    for (let x = 0; x < stride; x++) {
      const value = raw[from + x];
      const a = x >= channels ? line[x - channels] : 0; // pixel to the left
      const b = previous[x]; // pixel above
      const c = x >= channels ? previous[x - channels] : 0; // above-left

      let restored: number;
      switch (filter) {
        case 0: restored = value; break;
        case 1: restored = value + a; break;
        case 2: restored = value + b; break;
        case 3: restored = value + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          restored = value + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: return null;
      }
      line[x] = restored & 0xff;
    }

    // The alpha channel is every fourth byte. Faint anti-aliased edges don't
    // count as ink, or a single accidental tap would look like a signature.
    for (let x = 3; x < stride; x += channels) {
      if (line[x] > 32) ink++;
    }

    line.copy(previous);
  }

  return ink;
}
