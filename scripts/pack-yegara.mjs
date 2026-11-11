// npm run build:yegara — builds the website as a standalone server and packs it
// into a folder and a zip that run on cPanel's "Setup Node.js App" (Yegara
// HOST Premium). Build it on Linux (the GitHub workflow "Build for Yegara"):
// the image resizer (sharp) built on Windows does not run on the server.
//
//   deploy/yegara/
//     app.js         ← the startup file to enter in cPanel
//     package.json   (no dependencies: do NOT click "Run NPM Install")
//     server/        ← the website: server.js, .next, public, node_modules
//   deploy/omobeeza-yegara.zip
//
// The server sits in its own folder because cPanel (CloudLinux) keeps a
// "node_modules" link of its own in the application root.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
// --build: first run the normal build (with its prebuild steps) as a standalone server.
if (process.argv.includes("--build")) {
  execFileSync("npm", ["run", "build"], { stdio: "inherit", shell: true, env: { ...process.env, BUILD_TARGET: "yegara" } });
}
const standalone = path.join(root, ".next", "standalone");
if (!existsSync(path.join(standalone, "server.js"))) {
  console.error("No standalone build found. Run: npm run build:yegara");
  process.exit(1);
}

const out = path.join(root, "deploy", "yegara");
const server = path.join(out, "server");
rmSync(path.join(root, "deploy"), { recursive: true, force: true });
mkdirSync(server, { recursive: true });

cpSync(standalone, server, { recursive: true });
cpSync(path.join(root, ".next", "static"), path.join(server, ".next", "static"), { recursive: true });
// public/Videos holds the original video files (the site uses the compressed
// copies in public/media), so they stay behind.
cpSync(path.join(root, "public"), path.join(server, "public"), {
  recursive: true,
  filter: (src) => !/^(videos)$/i.test(path.relative(path.join(root, "public"), src)),
});
// Secrets belong in cPanel's environment variables, never in the upload.
for (const f of [".env", ".env.local", ".env.production", ".env.production.local"]) rmSync(path.join(server, f), { force: true });
rmSync(path.join(server, ".data"), { recursive: true, force: true });

writeFileSync(
  path.join(out, "app.js"),
  `// Startup file for cPanel "Setup Node.js App". Runs the Next.js server in ./server.
const path = require("path");
const dir = path.join(__dirname, "server");
process.env.NODE_ENV = "production";
// cPanel sets HOSTNAME to the machine's name; the server must accept every address.
process.env.HOSTNAME = "0.0.0.0";
process.chdir(dir);
require(path.join(dir, "server.js"));
`,
);
writeFileSync(
  path.join(out, "package.json"),
  JSON.stringify({ name: "omobeeza-website", private: true, main: "app.js", scripts: { start: "node app.js" } }, null, 2) + "\n",
);

const zip = path.join(root, "deploy", "omobeeza-yegara.zip");
// Windows' own tar (not Git's) can write zip files.
if (process.platform === "win32") {
  const tar = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
  execFileSync(tar, ["-a", "-c", "-f", zip, "-C", out, "."], { stdio: "inherit" });
} else execFileSync("zip", ["-qr", zip, "."], { cwd: out, stdio: "inherit" });
console.log(`Ready: ${path.relative(root, zip)} (upload and extract it in the application root)`);
