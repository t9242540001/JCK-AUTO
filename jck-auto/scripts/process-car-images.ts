/**
 * Обработка фото автомобилей для секции Countries.
 *
 * Использование:
 *   npx tsx scripts/process-car-images.ts
 *
 * Ожидает исходные файлы в scripts/raw/:
 *   - 1.jpg           → public/images/cars/china.jpg
 *   - hyundai.jpg      → public/images/cars/korea.jpg
 *   - XRV.jpg          → public/images/cars/japan.jpg
 */

import sharp from "sharp";
import path from "path";
import fs from "fs";

const RAW_DIR = path.join(__dirname, "raw");
const OUT_DIR = path.join(__dirname, "..", "public", "images", "cars");

const TARGET_WIDTH = 800;
const TARGET_ASPECT = 4 / 3; // ~600px height at 800px width
const QUALITY = 85;

interface ImageTask {
  input: string;
  output: string;
  label: string;
  cropStrategy?: "attention" | "entropy";
}

const tasks: ImageTask[] = [
  {
    input: path.join(RAW_DIR, "1.jpg"),
    output: path.join(OUT_DIR, "china.jpg"),
    label: "China (silver crossover)",
    cropStrategy: "attention",
  },
  {
    input: path.join(RAW_DIR, "hyundai.jpg"),
    output: path.join(OUT_DIR, "korea.jpg"),
    label: "Korea (Hyundai, dark blue)",
    cropStrategy: "attention",
  },
  {
    input: path.join(RAW_DIR, "XRV.jpg"),
    output: path.join(OUT_DIR, "japan.jpg"),
    label: "Japan (Honda XR-V, blue)",
    cropStrategy: "attention",
  },
];

async function processImage(task: ImageTask) {
  if (!fs.existsSync(task.input)) {
    console.log(`⚠ Skipping ${task.label}: ${task.input} not found`);
    return;
  }

  const targetHeight = Math.round(TARGET_WIDTH / TARGET_ASPECT);

  await sharp(task.input)
    .resize(TARGET_WIDTH, targetHeight, {
      fit: "cover",
      position: task.cropStrategy ?? "attention",
    })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toFile(task.output);

  const stats = fs.statSync(task.output);
  console.log(
    `✓ ${task.label}: ${TARGET_WIDTH}x${targetHeight}, ${(stats.size / 1024).toFixed(0)}KB → ${task.output}`
  );
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("Processing car images...\n");
  for (const task of tasks) {
    await processImage(task);
  }
  console.log("\nDone!");
}

main().catch(console.error);
