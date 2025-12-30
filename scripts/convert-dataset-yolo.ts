
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { fileURLToPath } from 'node:url';

// --- Configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATASET_DIR = path.join(PROJECT_ROOT, 'public', 'dataset');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'public', 'dataset', 'yolo_dataset');

// Create output directories
const DIRS = [
  path.join(OUTPUT_DIR, 'images', 'train'),
  path.join(OUTPUT_DIR, 'images', 'val'),
  path.join(OUTPUT_DIR, 'labels', 'train'),
  path.join(OUTPUT_DIR, 'labels', 'val'),
];

// --- Helpers ---

// Minimal JPEG size parser to avoid external dependencies
function getJpegSize(buffer: Buffer): { width: number; height: number } {
  let offset = 2;
  while (offset < buffer.length) {
    const marker = buffer.readUInt16BE(offset);
    offset += 2;
    if (marker >= 0xffc0 && marker <= 0xffcf && marker !== 0xffc4 && marker !== 0xffc8) {
      // Found SOF marker
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      return { width, height };
    }
    const length = buffer.readUInt16BE(offset);
    offset += length;
  }
  throw new Error('Could not determine JPEG dimensions');
}

async function ensureDirs() {
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  for (const dir of DIRS) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// --- Main Script ---

async function main() {
  console.log('🚀 Starting Dataset Conversion to YOLO format...');
  await ensureDirs();

  // Find ZIP files
  const files = fs.readdirSync(DATASET_DIR);
  const zipFiles = files.filter(f => f.endsWith('.zip'));
  
  console.log(`📦 Found ${zipFiles.length} ZIP files.`);

  let totalImages = 0;
  let trainCount = 0;
  let valCount = 0;

  for (const zipFile of zipFiles) {
    console.log(`Processing ${zipFile}...`);
    const data = fs.readFileSync(path.join(DATASET_DIR, zipFile));
    const zip = await JSZip.loadAsync(data);

    // Find annotations
    const annotationFiles = Object.keys(zip.files).filter(f => f.startsWith('annotations/') && f.endsWith('.json'));

    for (const annotFile of annotationFiles) {
      const annotContent = await zip.file(annotFile)?.async('string');
      if (!annotContent) continue;

      const annotation = JSON.parse(annotContent);
      // Ensure we have cards
      if (!annotation.cards || annotation.cards.length === 0) continue;

      // Find corresponding raw image
      // annotation.imageId usually holds "skyjo_raw_...jpg"
      const rawImageName = annotation.imageId;
      const rawImagePath = `raw/${rawImageName}`;
      
      const imageFile = zip.file(rawImagePath);
      if (!imageFile) {
        console.warn(`⚠️ Image not found for annotation: ${rawImageName}`);
        continue;
      }

      const imageBuffer = await imageFile.async('nodebuffer');
      
      // Get dimensions
      let dims;
      try {
        dims = getJpegSize(imageBuffer);
      } catch (e) {
        console.warn(`⚠️ Failed to get dimensions for ${rawImageName}`);
        continue;
      }

      // Convert to YOLO
      // class x_center y_center width height (normalized)
      const lines: string[] = [];
      
      for (const card of annotation.cards) {
        // We ignore the label value for detection (single class "card" -> 0)
        const cls = 0; 
        const { x, y, w, h } = card.bbox;

        const mx = x + w / 2;
        const my = y + h / 2;

        const nx = mx / dims.width;
        const ny = my / dims.height;
        const nw = w / dims.width;
        const nh = h / dims.height;

        lines.push(`${cls} ${nx.toFixed(6)} ${ny.toFixed(6)} ${nw.toFixed(6)} ${nh.toFixed(6)}`);
      }

      // Split Train/Val (80/20)
      const isTrain = Math.random() < 0.8;
      const type = isTrain ? 'train' : 'val';
      if (isTrain) trainCount++; else valCount++;

      // Write Image
      const outImgName = rawImageName; // Keep original name
      fs.writeFileSync(path.join(OUTPUT_DIR, 'images', type, outImgName), imageBuffer);

      // Write Label
      const labelName = rawImageName.replace('.jpg', '.txt').replace('.jpeg', '.txt');
      fs.writeFileSync(path.join(OUTPUT_DIR, 'labels', type, labelName), lines.join('\n'));
      
      totalImages++;
    }
  }

  // Generate data.yaml
  const yamlContent = `
path: ../${path.basename(OUTPUT_DIR)} # dataset root dir
train: images/train
val: images/val
test:  # test images (optional)

nc: 1
names: ['card']
  `.trim();

  fs.writeFileSync(path.join(OUTPUT_DIR, 'data.yaml'), yamlContent);

  console.log(`
✅ Conversion Complete!
--------------------------------
Total Images: ${totalImages}
Train: ${trainCount}
Val: ${valCount}
Output Directory: ${OUTPUT_DIR}
--------------------------------
You can now train your YOLO model using this dataset.
  `);
}

main().catch(console.error);
