import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const datasetDir = path.join(__dirname, '../public/dataset');
const manifestPath = path.join(datasetDir, 'manifest.json');

console.log(`Scanning ${datasetDir}...`);

try {
  if (!fs.existsSync(datasetDir)) {
    console.error(`Directory not found: ${datasetDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(datasetDir);
  // Filter only .zip files
  const zipFiles = files.filter(file => file.endsWith('.zip'));

  fs.writeFileSync(manifestPath, JSON.stringify(zipFiles, null, 2));
  console.log(`Manifest generated with ${zipFiles.length} files.`);
  console.log(`Saved to ${manifestPath}`);
} catch (err) {
  console.error('Error generating manifest:', err);
  process.exit(1);
}
