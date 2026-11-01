// Builds the photo galleries from the folders the ministry drops into /public:
//
//   public/lukaSiteChildern/   prayer cards of the Luka site children
//   public/carnival/           Children's Carnival Day photos
//   public/visionSharingDay/   Vision Sharing Day at ACLA Church photos
//
// For each photo it writes a web-optimized copy to public/img/gallery/<album>/
// and records its size in src/data/galleries.json, which the pages read.
// Runs automatically before `npm run dev` and `npm run build`, so new photos
// appear just by adding them to the folders.
//
//   node scripts/prepare-galleries.mjs
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import sharp from "sharp";

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, "public");
const OUT = path.join(PUBLIC, "img", "gallery");
const MANIFEST = path.join(ROOT, "src", "data", "galleries.json");
const IMAGE_RE = /\.(jpe?g|png|webp)$/i;

/** First existing folder among the candidates (tolerates spelling variants). */
function findFolder(...names) {
  for (const n of names) {
    const p = path.join(PUBLIC, n);
    if (existsSync(p)) return p;
  }
  return null;
}

async function listImages(dir) {
  if (!dir) return [];
  const files = await readdir(dir);
  return files.filter((f) => IMAGE_RE.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function slugify(file) {
  return path
    .parse(file)
    .name.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCase(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

async function writeJpeg(pipeline, file, width) {
  const info = await pipeline
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(file);
  return { w: info.width, h: info.height };
}

async function prepareLuka() {
  const dir = findFolder("lukaSiteChildern", "lukaSiteChildren", "LukaSiteChildren");
  const files = await listImages(dir);
  const outDir = path.join(OUT, "luka");
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const children = [];
  for (const file of files) {
    const slug = slugify(file);
    const src = path.join(dir, file);
    const meta = await sharp(src).rotate().metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    // Prayer cards are landscape: photo on the left, prayer + QR on the right.
    // Crop the photo half as a portrait; keep the whole card for the lightbox.
    const isCard = width > height;
    const portraitWidth = isCard ? Math.round(width * 0.47) : width;

    const portrait = await writeJpeg(
      sharp(src).rotate().extract({ left: 0, top: 0, width: portraitWidth, height }),
      path.join(outDir, `${slug}.jpg`),
      900,
    );
    const card = await writeJpeg(sharp(src).rotate(), path.join(outDir, `${slug}-card.jpg`), 1600);

    children.push({
      slug,
      name: titleCase(slug),
      portrait: { src: `/img/gallery/luka/${slug}.jpg`, ...portrait },
      card: { src: `/img/gallery/luka/${slug}-card.jpg`, ...card },
    });
  }
  return children;
}

async function prepareAlbum(id, ...folderNames) {
  const dir = findFolder(...folderNames);
  const files = await listImages(dir);
  const outDir = path.join(OUT, id);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const photos = [];
  for (const [i, file] of files.entries()) {
    const name = `${String(i + 1).padStart(3, "0")}.jpg`;
    const size = await writeJpeg(sharp(path.join(dir, file)).rotate(), path.join(outDir, name), 1800);
    photos.push({ src: `/img/gallery/${id}/${name}`, ...size });
  }
  return photos;
}

const manifest = {
  luka: await prepareLuka(),
  albums: {
    carnival: await prepareAlbum("carnival", "carnival", "Carnival", "childrenCarnival"),
    vision: await prepareAlbum("vision", "visionSharingDay", "visionSharingday", "VisionSharingDay"),
  },
};

await mkdir(path.dirname(MANIFEST), { recursive: true });
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `galleries: ${manifest.luka.length} Luka cards, ${manifest.albums.carnival.length} carnival, ${manifest.albums.vision.length} vision sharing`,
);
