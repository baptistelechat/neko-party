import JSZip from "jszip";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// --- Configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATASET_DIR = path.join(PROJECT_ROOT, "public", "dataset");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "public", "dataset", "yolo_dataset");

// Create output directories
const DIRS = [
  path.join(OUTPUT_DIR, "images", "train"),
  path.join(OUTPUT_DIR, "images", "validation"),
  path.join(OUTPUT_DIR, "labels", "train"),
  path.join(OUTPUT_DIR, "labels", "validation"),
];

// --- Helpers ---

// Minimal JPEG size parser to avoid external dependencies
function getJpegSize(buffer: Buffer): { width: number; height: number } {
  let offset = 2;
  while (offset < buffer.length) {
    const marker = buffer.readUInt16BE(offset);
    offset += 2;
    if (
      marker >= 0xffc0 &&
      marker <= 0xffcf &&
      marker !== 0xffc4 &&
      marker !== 0xffc8
    ) {
      // Found SOF marker
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      return { width, height };
    }
    const length = buffer.readUInt16BE(offset);
    offset += length;
  }
  throw new Error("Could not determine JPEG dimensions");
}

async function ensureDirs() {
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  for (const dir of DIRS) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// --- Main Script ---

async function main() {
  console.log("🚀 Starting Dataset Conversion to YOLO format...");
  await ensureDirs();

  // Find ZIP files
  const files = fs.readdirSync(DATASET_DIR);
  const zipFiles = files.filter((f) => f.endsWith(".zip"));

  console.log(`📦 Found ${zipFiles.length} ZIP files.`);

  // Pass 1: Collect all valid entries
  console.log("🔍 Scanning files to build index...");

  interface DatasetEntry {
    zipFile: string;
    annotFile: string;
    rawImageName: string;
    annotContent: string;
    // We don't store image buffer here to save memory
  }

  const allEntries: DatasetEntry[] = [];

  for (const zipFileName of zipFiles) {
    console.log(`  Scanning ${zipFileName}...`);
    const data = fs.readFileSync(path.join(DATASET_DIR, zipFileName));
    const zip = await JSZip.loadAsync(data);

    const annotationFiles = Object.keys(zip.files).filter(
      (f) => f.startsWith("annotations/") && f.endsWith(".json")
    );

    for (const annotFile of annotationFiles) {
      const annotContent = await zip.file(annotFile)?.async("string");
      if (!annotContent) continue;

      const annotation = JSON.parse(annotContent);
      if (!annotation.cards || annotation.cards.length === 0) continue;

      const rawImageName = annotation.imageId;
      const rawImagePath = `raw/${rawImageName}`;

      if (zip.file(rawImagePath)) {
        allEntries.push({
          zipFile: zipFileName,
          annotFile,
          rawImageName,
          annotContent,
        });
      }
    }
  }

  const totalImages = allEntries.length;
  console.log(`📊 Total valid images found: ${totalImages}`);

  if (totalImages === 0) {
    console.warn("⚠️ No images found!");
    return;
  }

  // Shuffle and Split
  console.log("🎲 Shuffling and splitting dataset (80/20 fixed)...");
  shuffleArray(allEntries);

  const trainSize = Math.floor(totalImages * 0.8); // Exactly 80%
  // Or force strict numbers if requested, but 80% is standard.
  // User asked for "fixed 1200/300" for 1500 images. Math.floor(0.8 * 1500) = 1200.

  const trainSet = new Set(allEntries.slice(0, trainSize));
  // The rest is validation

  let processedCount = 0;
  let trainCount = 0;
  let validationCount = 0;

  // Group by Zip to minimize file I/O
  const entriesByZip = new Map<string, DatasetEntry[]>();
  for (const entry of allEntries) {
    if (!entriesByZip.has(entry.zipFile)) {
      entriesByZip.set(entry.zipFile, []);
    }
    entriesByZip.get(entry.zipFile)?.push(entry);
  }

  // Pass 2: Write files
  console.log("💾 Writing files...");

  for (const [zipFileName, entries] of entriesByZip) {
    console.log(`  Processing content from ${zipFileName}...`);
    const data = fs.readFileSync(path.join(DATASET_DIR, zipFileName));
    const zip = await JSZip.loadAsync(data);

    for (const entry of entries) {
      const isTrain = trainSet.has(entry);
      const type = isTrain ? "train" : "validation";
      if (isTrain) trainCount++;
      else validationCount++;

      // Read Image
      const rawImagePath = `raw/${entry.rawImageName}`;
      const imageFile = zip.file(rawImagePath);
      if (!imageFile) continue; // Should not happen as we checked in Pass 1

      const imageBuffer = await imageFile.async("nodebuffer");

      // Get dimensions
      let dims;
      try {
        dims = getJpegSize(imageBuffer);
      } catch (e: any) {
        console.warn(
          `⚠️ Failed to get dimensions for ${entry.rawImageName} (${e.message})`
        );
        continue;
      }

      // Convert Annotation
      const annotation = JSON.parse(entry.annotContent);
      const lines: string[] = [];

      for (const card of annotation.cards) {
        const cls = 0;
        const { x, y, w, h } = card.bbox;

        const mx = x + w / 2;
        const my = y + h / 2;

        const nx = mx / dims.width;
        const ny = my / dims.height;
        const nw = w / dims.width;
        const nh = h / dims.height;

        lines.push(
          `${cls} ${nx.toFixed(6)} ${ny.toFixed(6)} ${nw.toFixed(
            6
          )} ${nh.toFixed(6)}`
        );
      }

      // Write Image
      const outImgName = entry.rawImageName;
      fs.writeFileSync(
        path.join(OUTPUT_DIR, "images", type, outImgName),
        imageBuffer
      );

      // Write Label
      const labelName = entry.rawImageName.replace(
        /\.(jpg|jpeg|png)$/i,
        ".txt"
      );
      fs.writeFileSync(
        path.join(OUTPUT_DIR, "labels", type, labelName),
        lines.join("\n")
      );

      processedCount++;
      if (processedCount % 100 === 0) {
        process.stdout.write(
          `    Progress: ${processedCount}/${totalImages}\r`
        );
      }
    }
  }

  // Generate data.yaml
  // Use absolute path to avoid confusion during training
  const absOutputDir = OUTPUT_DIR.replace(/\\/g, "/");
  console.log(`📝 Generating data.yaml with absolute path: ${absOutputDir}`);

  const yamlContent = `
path: ${absOutputDir} # dataset root dir
train: images/train
val: images/validation
test:  # test images (optional)

nc: 1
names: ['card']
  `.trim();

  fs.writeFileSync(path.join(OUTPUT_DIR, "data.yaml"), yamlContent);

  console.log(`
✅ Conversion Complete!
--------------------------------
Total Images: ${processedCount}
Train: ${trainCount}
Validation: ${validationCount}
Output Directory: ${OUTPUT_DIR}
--------------------------------
You can now train your YOLO model using this dataset.
  `);
}

main().catch(console.error);
