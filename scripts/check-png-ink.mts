/**
 * Checks the signature ink counter.
 *
 * Builds PNGs by hand — one per filter type — so the unfilter arithmetic is
 * checked against a known pixel count rather than against hope.
 */
import { deflateSync, crc32 } from "node:zlib";
import { countInkPixels } from "../src/lib/png-ink";

const W = 40, H = 12, CH = 4;

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

function makePng(pixels: Uint8Array, filter: number) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const stride = W * CH;
  const raw = Buffer.alloc((stride + 1) * H);
  const prev = Buffer.alloc(stride);

  for (let y = 0; y < H; y++) {
    raw[y * (stride + 1)] = filter;
    const line = Buffer.from(pixels.subarray(y * stride, (y + 1) * stride));
    for (let x = stride - 1; x >= 0; x--) {
      const a = x >= CH ? line[x - CH] : 0;
      const b = prev[x];
      const c = x >= CH ? prev[x - CH] : 0;
      let enc: number;
      switch (filter) {
        case 0: enc = line[x]; break;
        case 1: enc = line[x] - a; break;
        case 2: enc = line[x] - b; break;
        case 3: enc = line[x] - ((a + b) >> 1); break;
        default: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          enc = line[x] - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
        }
      }
      raw[y * (stride + 1) + 1 + x] = enc & 0xff;
    }
    line.copy(prev);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const blank = new Uint8Array(W * H * CH);

const inked = new Uint8Array(W * H * CH);
let expected = 0;
for (let y = 4; y < 8; y++) {
  for (let x = 5; x < 25; x++) {
    const i = (y * W + x) * CH;
    inked[i] = 58; inked[i + 1] = 55; inked[i + 2] = 47; inked[i + 3] = 255;
    expected++;
  }
}

const faint = new Uint8Array(W * H * CH);
for (let x = 0; x < W; x++) faint[(2 * W + x) * CH + 3] = 20; // below the threshold

let bad = 0;
for (let f = 0; f <= 4; f++) {
  const b = countInkPixels(makePng(blank, f));
  const i = countInkPixels(makePng(inked, f));
  const t = countInkPixels(makePng(faint, f));
  const ok = b === 0 && i === expected && t === 0;
  if (!ok) bad++;
  console.log(`  filter ${f}: blank=${b} inked=${i} (want ${expected}) faint=${t} ${ok ? "ok" : "WRONG"}`);
}

console.log(`  not a PNG at all -> ${countInkPixels(Buffer.from("hello world"))}`);
console.log(`  truncated        -> ${countInkPixels(makePng(inked, 0).subarray(0, 40))}`);
console.log(bad === 0 ? "\n  All filter types decode correctly." : "\n  SOMETHING IS WRONG.");
if (bad > 0) process.exit(1);
