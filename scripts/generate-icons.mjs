import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../packages/client/public');

const svgContent = readFileSync(join(publicDir, 'favicon.svg'), 'utf8');

const sizes = [192, 512];

async function generateIcons() {
  console.log('Generating PWA icons from favicon.svg...');

  for (const size of sizes) {
    const outputPath = join(publicDir, `pwa-${size}x${size}.png`);

    await sharp(Buffer.from(svgContent))
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`  Created pwa-${size}x${size}.png`);
  }

  // Also create apple-touch-icon (180x180)
  const applePath = join(publicDir, 'apple-touch-icon.png');
  await sharp(Buffer.from(svgContent))
    .resize(180, 180)
    .png()
    .toFile(applePath);
  console.log('  Created apple-touch-icon.png');

  console.log('Done!');
}

generateIcons().catch(console.error);
