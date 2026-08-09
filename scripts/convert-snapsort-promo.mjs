import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const promoRoot = resolve(repoRoot, "promo-output/snapsort");
const mastersDir = resolve(promoRoot, "masters");
const mp4Dir = resolve(promoRoot, "mp4");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    ...options,
  });

  if (result.status !== 0) {
    const detail = result.stderr || result.stdout || `${command} failed`;
    throw new Error(detail.trim());
  }

  return result.stdout;
}

function inspectVideo(path) {
  const output = run("ffprobe", [
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    path,
  ]);
  const probe = JSON.parse(output);
  const video = probe.streams.find((stream) => stream.codec_type === "video");
  const audio = probe.streams.find((stream) => stream.codec_type === "audio");

  if (!video) throw new Error(`No video stream found in ${path}`);

  return {
    file: path.slice(repoRoot.length + 1),
    codec: video.codec_name,
    width: video.width,
    height: video.height,
    pixelFormat: video.pix_fmt,
    frameRate: video.avg_frame_rate,
    duration: Number(probe.format.duration),
    audio: Boolean(audio),
  };
}

run("ffmpeg", ["-version"]);
run("ffprobe", ["-version"]);

const masters = readdirSync(mastersDir)
  .filter((file) => extname(file) === ".webm")
  .sort();

if (masters.length !== 6) {
  throw new Error(`Expected 6 WebM masters, found ${masters.length}.`);
}

mkdirSync(mp4Dir, { recursive: true });
const manifest = [];

for (const master of masters) {
  const source = resolve(mastersDir, master);
  const destination = resolve(mp4Dir, master.replace(/\.webm$/, ".mp4"));

  run(
    "ffmpeg",
    [
      "-y",
      "-i",
      source,
      "-vf",
      "fps=30,scale=1200:1200:force_original_aspect_ratio=decrease,pad=1200:1200:(ow-iw)/2:(oh-ih)/2",
      "-an",
      "-c:v",
      "libx264",
      "-profile:v",
      "high",
      "-pix_fmt",
      "yuv420p",
      "-b:v",
      "6M",
      "-maxrate",
      "10M",
      "-bufsize",
      "12M",
      "-movflags",
      "+faststart",
      destination,
    ],
    { stdio: "inherit" },
  );

  const webm = inspectVideo(source);
  const mp4 = inspectVideo(destination);
  if (webm.width !== 1200 || webm.height !== 1200) {
    throw new Error(`${master} was not captured at 1200x1200.`);
  }
  if (
    mp4.codec !== "h264" ||
    mp4.width !== 1200 ||
    mp4.height !== 1200 ||
    mp4.pixelFormat !== "yuv420p" ||
    mp4.audio
  ) {
    throw new Error(`${destination} does not match the promo delivery spec.`);
  }
  if (mp4.duration < 3 || mp4.duration > 10) {
    throw new Error(`${destination} has an unexpected duration.`);
  }

  manifest.push({ name: master.replace(/\.webm$/, ""), webm, mp4 });
}

writeFileSync(
  resolve(promoRoot, "manifest.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), clips: manifest }, null, 2)}\n`,
);

console.log(`Created ${manifest.length} WebM masters and MP4 delivery files.`);
