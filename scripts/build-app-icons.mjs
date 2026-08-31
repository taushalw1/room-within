#!/usr/bin/env node
/**
 * Builds the home-screen icons from the badge logo.
 *
 *   npm run build:icons
 *
 * Three shapes are needed, and they are not interchangeable:
 *
 *   - A plain square icon, for browsers and older Android.
 *   - A *maskable* icon, which Android crops to whatever shape the phone
 *     prefers — a circle, a squircle, a rounded square. Anything within about
 *     10% of the edge can be cut off, so the badge is inset to the middle 60%
 *     and the rest is cream. Without this, Android crops into the artwork.
 *   - An apple-touch-icon, which iOS renders on its own rounded rectangle and
 *     which must not be transparent, or it comes out black.
 *
 * Run this whenever the logo changes.
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SOURCE = "public/logo-badge.png";
const OUT = "public/icons";

/** Cream, --color-cream in globals.css. */
const CREAM = { r: 250, g: 246, b: 236, alpha: 1 };

await mkdir(OUT, { recursive: true });

/**
 * @param size    the finished square, in pixels
 * @param inset   how much of the square the badge fills (1 = edge to edge)
 * @param name    output filename
 */
async function icon(size, inset, name) {
  const badge = Math.round(size * inset);

  const logo = await sharp(SOURCE)
    .resize(badge, badge, { fit: "contain", background: { ...CREAM, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: CREAM,
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(`${OUT}/${name}`);

  console.log(`  ${name.padEnd(28)} ${size}x${size}`);
}

console.log("\nBuilding home-screen icons\n");

// Plain icons: the badge nearly fills the square.
await icon(192, 0.82, "icon-192.png");
await icon(512, 0.82, "icon-512.png");

// Maskable: inset hard, because Android will crop.
await icon(192, 0.6, "icon-192-maskable.png");
await icon(512, 0.6, "icon-512-maskable.png");

// iOS draws its own rounded corners and needs an opaque background.
await icon(180, 0.78, "apple-touch-icon.png");

console.log("\nDone.\n");
