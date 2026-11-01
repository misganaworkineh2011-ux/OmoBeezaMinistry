// Produces clean, web-optimized crops of the ministry's real photographs into
// public/img/photos/. Several source images carry template artifacts (white
// curved / torn left edges, a darkening overlay) which are trimmed here so the
// redesigned layouts can use them full-bleed.
//
//   node scripts/prepare-photos.mjs
import path from "node:path";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const SRC = path.join(process.cwd(), "public", "img");
const OUT = path.join(SRC, "photos");

/** @type {{ src: string; out: string; extract?: sharp.Region; brighten?: number }[]} */
const JOBS = [
  { src: "group_picture.jpeg", out: "group.jpg" },
  { src: "kid.jpeg", out: "smile.jpg" },
  { src: "photo_2025-06-04_11-34-34.jpg", out: "drawings.jpg", extract: { left: 80, top: 0, width: 1062, height: 1125 } },
  { src: "photo_2025-06-03_22-23-41.jpg", out: "family.jpg", brighten: 1.55 },
  { src: "inv.jpg", out: "classroom.jpg", extract: { left: 270, top: 0, width: 708, height: 1029 } },
  { src: "children.png", out: "gathering.jpg", extract: { left: 215, top: 0, width: 983, height: 1125 } },
];

await mkdir(OUT, { recursive: true });

for (const job of JOBS) {
  let img = sharp(path.join(SRC, job.src));
  if (job.extract) img = img.extract(job.extract);
  if (job.brighten) img = img.modulate({ brightness: job.brighten, saturation: 1.08 }).gamma(1.1);
  await img
    .resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(OUT, job.out));
  console.log("wrote", job.out);
}
