// Converts the ministry's videos into web-ready files.
//
//   Source folder: public/videos/  (or media-src/videos/, see README)
//   Output:        public/media/videos/<id>.mp4          full video, H.264 + AAC, streamable
//                  public/media/videos/<id>-preview.mp4  short, silent, small loop for previews
//                  public/media/videos/<id>.jpg          poster image
//                  src/data/videos.json                  manifest read by the pages
//
// Browsers can't play every phone/camera file (e.g. .mov with PCM audio) and
// the originals are very large, so each video is re-encoded once. Results are
// cached by source name + size, so later runs only process new or changed files.
//
//   node scripts/prepare-videos.mjs
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";

const run = promisify(execFile);
const ROOT = process.cwd();
const SOURCES = [path.join(ROOT, "media-src", "videos"), path.join(ROOT, "public", "videos"), path.join(ROOT, "public", "Videos")];
const OUT = path.join(ROOT, "public", "media", "videos");
const MANIFEST = path.join(ROOT, "src", "data", "videos.json");
const VIDEO_RE = /\.(mp4|mov|m4v|webm)$/i;
// Bump when the encoding settings change, to re-encode everything once.
const ENCODER_VERSION = 3;

// Known videos: stable id, the moment used for the poster/preview (seconds),
// an optional crop (w:h:x:y) that removes black bars baked into the source,
// and the order they appear in. Unknown files are still included, after these.
const KNOWN = [
  { match: /documentary/i, id: "documentary", poster: 6, preview: 4, kind: "film", crop: "1920:828:0:128" },
  { match: /logo/i, id: "logo", poster: 7, preview: 0, kind: "logo" },
  { match: /mission/i, id: "mission", poster: 6.5, preview: 3, kind: "reel" },
  { match: /playground/i, id: "playground", poster: 3, preview: 2, kind: "reel", crop: "1080:1080:0:420" },
  { match: /short movie 2/i, id: "short2", poster: 2, preview: 0.5, kind: "reel" },
  { match: /short movie/i, id: "short1", poster: 6.5, preview: 0.5, kind: "reel" },
];

const sourceDir = SOURCES.find((d) => existsSync(d));

async function probe(file) {
  const { stdout } = await run(ffprobe.path, [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height:format=duration",
    "-of", "json",
    file,
  ]);
  const data = JSON.parse(stdout);
  const s = data.streams?.[0] ?? {};
  return { w: s.width ?? 0, h: s.height ?? 0, duration: Number(data.format?.duration ?? 0) };
}

function ffmpeg(args) {
  return run(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", ...args], { maxBuffer: 1 << 26 });
}

function slugify(name) {
  return name.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function main() {
  let previous = { videos: [] };
  try {
    previous = JSON.parse(await readFile(MANIFEST, "utf8"));
  } catch {
    // First run.
  }
  const cache = new Map(previous.videos.map((v) => [v.source, v]));

  const files = sourceDir ? (await readdir(sourceDir)).filter((f) => VIDEO_RE.test(f)) : [];
  // The original videos are large and not committed to git; on a server build
  // (e.g. Vercel) keep the already-processed videos and their manifest as-is.
  if (files.length === 0 && previous.videos.length > 0) {
    console.log(`videos: no source videos found, keeping ${previous.videos.length} processed video(s)`);
    return;
  }
  await mkdir(OUT, { recursive: true });

  const videos = [];
  for (const file of files) {
    const full = path.join(sourceDir, file);
    const { size } = await stat(full);
    const known = KNOWN.find((k) => k.match.test(file));
    const id = known?.id ?? slugify(file);
    const key = `${file}|${size}|v${ENCODER_VERSION}`;
    const cached = cache.get(key);
    if (cached && existsSync(path.join(ROOT, "public", cached.src.slice(1)))) {
      videos.push(cached);
      continue;
    }

    const meta = await probe(full);
    const crop = known?.crop ? `crop=${known.crop},` : "";
    const [cw, ch] = known?.crop ? known.crop.split(":").map(Number) : [meta.w, meta.h];
    const portrait = ch > cw;
    const square = cw === ch;
    // Long edge: 1080 for landscape films, 1280 for vertical clips (phone-sized).
    const scale = crop + (portrait || square ? "scale=720:-2" : "scale='min(1920,iw)':-2");
    const posterAt = Math.min(known?.poster ?? 1, Math.max(0, meta.duration - 0.5));
    const previewAt = Math.min(known?.preview ?? 0, Math.max(0, meta.duration - 4));
    const mp4 = path.join(OUT, `${id}.mp4`);

    console.log(`video: encoding ${file} …`);
    await ffmpeg([
      "-i", full,
      "-map", "0:v:0", "-map", "0:a:0?",
      "-vf", scale,
      "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-pix_fmt", "yuv420p", "-profile:v", "high",
      // Cap the bitrate so long videos stream smoothly on modest connections.
      "-maxrate", portrait ? "1600k" : "2800k", "-bufsize", portrait ? "3200k" : "5600k",
      "-c:a", "aac", "-b:a", "128k", "-ac", "2",
      "-movflags", "+faststart",
      mp4,
    ]);
    // Silent, small, ~5s loop for autoplaying previews.
    await ffmpeg([
      "-ss", String(previewAt), "-t", "5", "-i", full,
      "-an",
      "-vf", crop + (portrait || square ? "scale=360:-2,fps=24" : "scale=-2:360,fps=24"),
      "-c:v", "libx264", "-preset", "medium", "-crf", "30", "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      path.join(OUT, `${id}-preview.mp4`),
    ]);
    await ffmpeg([
      "-ss", String(posterAt), "-i", full,
      "-frames:v", "1", "-vf", crop + (portrait || square ? "scale=720:-2" : "scale=1280:-2"), "-q:v", "3",
      path.join(OUT, `${id}.jpg`),
    ]);

    const out = await probe(mp4);
    videos.push({
      id,
      source: key,
      kind: known?.kind ?? (portrait ? "reel" : "film"),
      src: `/media/videos/${id}.mp4`,
      preview: `/media/videos/${id}-preview.mp4`,
      poster: `/media/videos/${id}.jpg`,
      w: out.w,
      h: out.h,
      duration: Math.round(out.duration),
    });
  }

  const order = (v) => {
    const i = KNOWN.findIndex((k) => k.id === v.id);
    return i === -1 ? KNOWN.length : i;
  };
  videos.sort((a, b) => order(a) - order(b));

  await mkdir(path.dirname(MANIFEST), { recursive: true });
  await writeFile(MANIFEST, `${JSON.stringify({ videos }, null, 2)}\n`);
  console.log(`videos: ${videos.length} ready (${videos.map((v) => v.id).join(", ") || "none"})`);
}

await main();
