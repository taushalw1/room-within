#!/usr/bin/env node
/**
 * Cuts the brand assets out of the two source files the client supplied and
 * writes them into public/.
 *
 * Run again if either source file is replaced:
 *   node scripts/build-brand-assets.mjs
 *
 * Sources (not in the repo — they live wherever you saved them):
 *   Room Within variations.png   the three logo lockups on one cream sheet
 *   1000023041.png               the fundraising poster, whose top-right
 *                                corner holds the building render
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const LOGO_SRC = process.env.LOGO_SRC ?? "C:/Users/tyler/Downloads/Room Within variations.png";
const POSTER_SRC = process.env.POSTER_SRC ?? "C:/Users/tyler/Downloads/1000023041.png";

await mkdir("public", { recursive: true });

/**
 * The logo sheet is flat cream behind two-tone line art. Rather than ship that
 * cream and have it show as a pale box on the parchment sections, the
 * background is converted to transparency.
 *
 * Partly-transparent edge pixels are un-blended against the known background
 * colour, so the anti-aliased edges keep their true ink colour instead of
 * leaving a cream halo when the logo sits on a darker surface.
 */
async function cutout(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bg = [data[0], data[1], data[2]];
  const LO = 10; // below this distance from the background, fully transparent
  const HI = 45; // above it, fully opaque

  for (let i = 0; i < data.length; i += 4) {
    const d = Math.max(
      Math.abs(data[i] - bg[0]),
      Math.abs(data[i + 1] - bg[1]),
      Math.abs(data[i + 2] - bg[2]),
    );

    let a = (d - LO) / (HI - LO);
    a = a < 0 ? 0 : a > 1 ? 1 : a;

    if (a === 0) {
      data[i + 3] = 0;
      continue;
    }

    if (a < 1) {
      // observed = a*source + (1-a)*background  ->  solve for source
      for (let c = 0; c < 3; c++) {
        const v = (data[i + c] - (1 - a) * bg[c]) / a;
        data[i + c] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
      }
    }

    data[i + 3] = Math.round(a * 255);
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Crop a region, trim the surrounding background, then cut it out. */
async function logoVariant(region, out) {
  const cropped = await sharp(LOGO_SRC).extract(region).toBuffer();
  const trimmed = await sharp(cropped).trim({ threshold: 12 }).toBuffer();
  const png = await cutout(trimmed);
  const info = await sharp(png).toFile(`public/${out}`);
  console.log(`${out.padEnd(22)} ${info.width}x${info.height}  ${Math.round(info.size / 1024)}KB`);
}

// The sheet is 1254x1254: stacked lockup across the top, badge bottom-left,
// horizontal lockup bottom-right.
await logoVariant({ left: 0, top: 0, width: 1254, height: 700 }, "logo-stacked.png");
await logoVariant({ left: 0, top: 690, width: 530, height: 564 }, "logo-badge.png");
await logoVariant({ left: 530, top: 690, width: 724, height: 564 }, "logo-lockup.png");

/* Two derived crops the supplied sheet doesn't provide directly. */

// Symbol on its own, taken from the top of the stacked lockup.
{
  const png = await sharp("public/logo-stacked.png")
    .extract({ left: 250, top: 0, width: 370, height: 340 })
    .trim({ threshold: 12 })
    .png({ compressionLevel: 9 })
    .toFile("public/logo-mark.png");
  console.log(`${"logo-mark.png".padEnd(22)} ${png.width}x${png.height}  ${Math.round(png.size / 1024)}KB`);
}

// Horizontal lockup with the rule and tagline cropped off, for the site
// header — at 40px tall the tagline is unreadable and just adds noise.
{
  const png = await sharp("public/logo-lockup.png")
    .extract({ left: 0, top: 0, width: 522, height: 228 })
    .trim({ threshold: 12 })
    .png({ compressionLevel: 9 })
    .toFile("public/logo-lockup-compact.png");
  console.log(`${"logo-lockup-compact.png".padEnd(22)} ${png.width}x${png.height}  ${Math.round(png.size / 1024)}KB`);
}

// Browser-tab icon: the symbol on the brand cream.
{
  const mark = await sharp("public/logo-mark.png")
    .resize({ width: 200, height: 200, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  const icon = await sharp({
    create: { width: 256, height: 256, channels: 4, background: "#faf6ec" },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile("src/app/icon.png");
  console.log(`${"src/app/icon.png".padEnd(22)} ${icon.width}x${icon.height}  ${Math.round(icon.size / 1024)}KB`);
}

/**
 * The building render occupies the poster's top-right corner. The left edge of
 * that artwork fades into the poster's cream, which suits the site — the same
 * cream is the page background, so the crop blends rather than ending on a
 * hard line.
 */
const building = await sharp(POSTER_SRC)
  // Kept clear of the headline on the left and the strapline underneath —
  // a wider crop drags "HELP PRESERVE" and "Grassy Lake History" into frame.
  .extract({ left: 452, top: 0, width: 572, height: 448 })
  .resize({ width: 1256, kernel: "lanczos3" }) // 2x for sharp rendering
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile("public/building.jpg");

console.log(
  `${"building.jpg".padEnd(22)} ${building.width}x${building.height}  ${Math.round(building.size / 1024)}KB`,
);
