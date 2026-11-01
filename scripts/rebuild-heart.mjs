// Regenerate a "heart" graphic by filling the original heart silhouette with a
// chosen photo, while preserving the navy brush/pin overlay from the original.
//
// Strategy:
//   - final.original.png is a heart-masked photo with a navy-blue brush + pin
//     painted on top, flattened to one RGBA PNG.
//   - alpha channel  -> exact heart silhouette (mask).
//   - navy-blue pixels -> the brush/pin overlay (kept, with soft anti-aliased alpha).
//   - We drop in a new photo (cover-cropped to the heart), re-apply the heart
//     mask, then paint the original blue overlay back on top.
//
// Usage: node scripts/rebuild-heart.mjs <fillPhoto> <outFile> [cropPosition]
//   fillPhoto    path to the photo to fill the heart (default group_picture.jpeg)
//   outFile      output PNG path (default public/img/final-new.png — a preview)
//   cropPosition sharp position for the cover crop (default "centre"; "top" keeps
//                a portrait subject's face in frame)
//
// Optional env PRECROP="left,top,width,height" extracts that region of the fill
// photo before the cover crop — use it to steer the subject into a clear area of
// the heart (away from the navy pin).

import sharp from "sharp";

const SRC = "public/img/final.original.png"; // pristine original: source of heart shape + blue overlay
const FILL = process.argv[2] || "public/img/group_picture.jpeg";
const OUT = process.argv[3] || "public/img/final-new.png";
const POSITION = process.argv[4] || "centre";
const PRECROP = process.env.PRECROP
  ? Object.fromEntries(
    ["left", "top", "width", "height"].map((k, i) => [k, Number(process.env.PRECROP.split(",")[i])])
  )
  : null;
// Optional circular inset (e.g. a face) placed in the pin's hollow circle:
//   INSET_FILL=path INSET="left,top,diam" [INSET_PRECROP="left,top,w,h"]
const INSET_FILL = process.env.INSET_FILL || null;
const INSET = process.env.INSET ? process.env.INSET.split(",").map(Number) : null; // [left, top, diam]
const INSET_PRECROP = process.env.INSET_PRECROP
  ? Object.fromEntries(
    ["left", "top", "width", "height"].map((k, i) => [k, Number(process.env.INSET_PRECROP.split(",")[i])])
  )
  : null;

const orig = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = orig.info;
const od = orig.data; // RGBA

let heartAlpha = Buffer.alloc(W * H); // single-channel heart silhouette
let blue = Buffer.alloc(W * H * 4); // RGBA: the navy overlay only

for (let i = 0; i < W * H; i++) {
  const r = od[i * 4];
  const g = od[i * 4 + 1];
  const b = od[i * 4 + 2];
  const a = od[i * 4 + 3];
  heartAlpha[i] = a;

  // "blueness": navy where blue dominates red/green. Soft ramp for clean edges.
  let blueness = 0;
  if (a > 30 && b > 85) {
    blueness = Math.max(0, Math.min(1, (b - Math.max(r, g) - 8) / 45));
  }
  const oa = Math.round(a * blueness);
  blue[i * 4] = r;
  blue[i * 4 + 1] = g;
  blue[i * 4 + 2] = b;
  blue[i * 4 + 3] = oa;
}

// Optional: mirror the heart + navy overlay horizontally (FLIP=1), moving the
// pin/hollow-circle to the opposite side. The heart shape is symmetric.
if (process.env.FLIP) {
  const hf = Buffer.alloc(W * H);
  const bf = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = W - 1 - x;
      hf[y * W + x] = heartAlpha[y * W + sx];
      for (let c = 0; c < 4; c++) bf[(y * W + x) * 4 + c] = blue[(y * W + sx) * 4 + c];
    }
  }
  heartAlpha = hf;
  blue = bf;
}

// Photo layer: the chosen photo fills the heart, clipped to its silhouette.
const photoPipe = sharp(FILL);
if (PRECROP) photoPipe.extract(PRECROP);
const photo = await photoPipe
  .resize(W, H, { fit: "cover", position: POSITION })
  .toBuffer();

// Optional: drop a circular inset photo (e.g. a face) into the pin's hollow circle.
let photoBuf = photo;
if (INSET && INSET_FILL) {
  const [il, it, idiam] = INSET;
  const circleMask = Buffer.from(
    `<svg width="${idiam}" height="${idiam}"><circle cx="${idiam / 2}" cy="${idiam / 2}" r="${idiam / 2}" fill="#fff"/></svg>`
  );
  const insetPipe = sharp(INSET_FILL);
  if (INSET_PRECROP) insetPipe.extract(INSET_PRECROP);
  const insetImg = await insetPipe
    .resize(idiam, idiam, { fit: "cover" })
    .composite([{ input: circleMask, blend: "dest-in" }])
    .png()
    .toBuffer();
  photoBuf = await sharp(photo).composite([{ input: insetImg, left: il, top: it }]).toBuffer();
}

const base = await sharp(photoBuf)
  .ensureAlpha()
  .raw()
  .toBuffer();
for (let i = 0; i < W * H; i++) {
  base[i * 4 + 3] = Math.min(base[i * 4 + 3], heartAlpha[i]);
}


// Calculate a clean procedural inner heart stroke using distance to the edge.
const THICKNESS = 4;
const INSET_DIST = 16;
let strokeAlpha = Buffer.alloc(W * H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (heartAlpha[y * W + x] < 128) continue; // outside
    
    // Find distance to nearest transparent pixel
    let minDist = 999;
    let searchRadius = INSET_DIST + THICKNESS + 2;
    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        let sy = y + dy, sx = x + dx;
        if (sy >= 0 && sy < H && sx >= 0 && sx < W) {
           if (heartAlpha[sy * W + sx] < 128) {
              let d = Math.sqrt(dx*dx + dy*dy);
              if (d < minDist) minDist = d;
           }
        } else {
           let d = Math.sqrt(dx*dx + dy*dy);
           if (d < minDist) minDist = d;
        }
      }
    }
    
    // Antialiased stroke
    if (minDist > INSET_DIST && minDist < INSET_DIST + THICKNESS) {
      let center = INSET_DIST + THICKNESS / 2;
      let distToCenter = Math.abs(minDist - center);
      let alpha = Math.max(0, Math.min(255, 255 - (distToCenter - (THICKNESS/2 - 1)) * 255));
      strokeAlpha[y * W + x] = alpha;
    }
  }
}

// Top layer. Default: draw the clean inner heart line (no paint splash), clipped to the heart.
// RING="cx,cy,r,strokeWidth": instead draw a single clean blue hollow circle.
let out;
if (process.env.RING) {
  const [cx, cy, r, sw] = process.env.RING.split(",").map(Number);
  const ring = Buffer.from(
    `<svg width="${W}" height="${H}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1E4A7C" stroke-width="${sw}"/></svg>`
  );
  const composed = await sharp(base, { raw: { width: W, height: H, channels: 4 } })
    .composite([{ input: ring }])
    .ensureAlpha()
    .raw()
    .toBuffer();
  for (let i = 0; i < W * H; i++) {
    composed[i * 4 + 3] = Math.min(composed[i * 4 + 3], heartAlpha[i]); // keep ring inside heart
  }
  out = await sharp(composed, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
} else {
  // Output the clean masked heart and blend the procedural blue inner heart line on top
  const composed = Buffer.from(base);
  for (let i = 0; i < W * H; i++) {
    const sa = strokeAlpha[i] / 255;
    if (sa > 0) {
      // Blend 30, 74, 124 (brand blue) over the existing pixel
      composed[i * 4] = composed[i * 4] * (1 - sa) + 30 * sa;
      composed[i * 4 + 1] = composed[i * 4 + 1] * (1 - sa) + 74 * sa;
      composed[i * 4 + 2] = composed[i * 4 + 2] * (1 - sa) + 124 * sa;
      // Alpha remains same (from base)
    }
  }
  
  out = await sharp(composed, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toBuffer();
}

await sharp(out).toFile(OUT);

console.log(`Wrote ${OUT} (${W}x${H})`);
