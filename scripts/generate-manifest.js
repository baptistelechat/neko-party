import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const datasetDir = path.join(__dirname, '../public/dataset');
const manifestPath = path.join(datasetDir, 'manifest.json');

console.log(`Scanning ${datasetDir}...`);

async function generateManifest() {
  try {
    if (!fs.existsSync(datasetDir)) {
      console.error(`Directory not found: ${datasetDir}`);
      process.exit(1);
    }

    const files = fs.readdirSync(datasetDir);
    // Filter only .zip files
    const zipFilenames = files.filter(file => file.endsWith('.zip'));
    
    const manifest = [];

    for (const filename of zipFilenames) {
      const filePath = path.join(datasetDir, filename);
      const data = fs.readFileSync(filePath);
      
      try {
        const zip = await JSZip.loadAsync(data);
        const count = Object.keys(zip.files).filter(
          (path) =>
            path.startsWith("crops/") &&
            (path.endsWith(".jpg") || path.endsWith(".jpeg"))
        ).length;

        manifest.push({
          filename,
          count,
          size: data.length
        });
        console.log(`Processed ${filename}: ${count} images`);
      } catch (e) {
        console.error(`Failed to read zip ${filename}:`, e.message);
        // Fallback entry if zip is corrupt
        manifest.push({
          filename,
          count: 0,
          size: data.length,
          error: e.message
        });
      }
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`Manifest generated with ${manifest.length} files.`);
    console.log(`Saved to ${manifestPath}`);
  } catch (err) {
    console.error('Error generating manifest:', err);
    process.exit(1);
  }
}

generateManifest();
