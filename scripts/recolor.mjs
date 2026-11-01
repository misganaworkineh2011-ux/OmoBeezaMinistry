// Recolor leftover orange theme PNGs to the company blue (#1E4A7C).
// Originals are backed up to public/img/_orig/ before any file is overwritten.
//
//   node scripts/recolor.mjs
//
// - about-vector-1.png / events-vector-1.png: flat tint (replace RGB, keep alpha).
// - final.png: selective tint of only the saturated-orange overlay (photos untouched).

import sharp from "sharp";
import { mkdir, copyFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IMG = join(ROOT, "public", "img");
const ORIG = join(IMG, "_orig");

// Company blue — matches --ul-primary in public/css/style.css.
const BLUE = { r: 30, g: 74, b: 124 };
// The baked-in overlay orange measured across the assets.
const ORANGE = { r: 240, g: 72, b: 24 };

/** Back the file up once, then return its raw RGBA buffer + dimensions. */
async function load(name) {
  const src = join(IMG, name);
  const backup = join(ORIG, name);
  try {
    await access(backup);
  } catch {
    await copyFile(src, backup);
  }
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, info, src };
}

async function save(src, data, info) {
  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(src);
}

/** Replace every visible pixel's RGB with blue; keep its alpha. */
async function flatTint(name) {
  const { data, info, src } = await load(name);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue; // fully transparent → leave
    data[i] = BLUE.r;
    data[i + 1] = BLUE.g;
    data[i + 2] = BLUE.b;
  }
  await save(src, data, info);
  console.log(`flat-tinted  ${name}`);
}

/**
 * Recolor only the orange overlay: a pixel qualifies when it is close to the
 * reference orange AND highly saturated (the photographs are far less saturated,
 * so skin/clothing is preserved). The pixel's brightness offset from the
 * reference is carried onto the blue so anti-aliased edges feather cleanly.
 */
async function selectiveTint(name, { distMax = 90, satMin = 110 } = {}) {
  const { data, info, src } = await load(name);
  let changed = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (data[i + 3] < 16) continue;

    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    const dr = r - ORANGE.r;
    const dg = g - ORANGE.g;
    const db = b - ORANGE.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    if (sat >= satMin && dist <= distMax) {
      // brightness delta vs. the reference orange's luma
      const lumaO = 0.299 * ORANGE.r + 0.587 * ORANGE.g + 0.114 * ORANGE.b;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const delta = luma - lumaO;
      data[i] = clamp(BLUE.r + delta);
      data[i + 1] = clamp(BLUE.g + delta);
      data[i + 2] = clamp(BLUE.b + delta);
      changed++;
    }
  }
  await save(src, data, info);
  console.log(`selective    ${name} (${changed} px recolored)`);
}

function clamp(v) {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

await mkdir(ORIG, { recursive: true });
await flatTint("about-vector-1.png");
await flatTint("events-vector-1.png");
await selectiveTint("final.png");
console.log("done.");
