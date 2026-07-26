/**
 * Genera los iconos de la PWA a partir de public/logo-bivi.png.
 *
 * Se corre a mano cuando cambia el logo:  node scripts/generate-icons.mjs
 *
 * El logo original es cuadrado y con fondo full-bleed, asi que sirve tal cual
 * como icono "maskable" (Android le recorta las esquinas sin comerse el
 * emblema, que ya vive en el circulo del centro).
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'public', 'logo-bivi.png');

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable.png', size: 192 },
  { file: 'apple-icon.png', size: 180 },
];

for (const { file, size } of targets) {
  const out = join(root, 'public', file);
  await sharp(source).resize(size, size, { fit: 'cover' }).png({ quality: 90 }).toFile(out);
  console.log(`✓ ${file} (${size}x${size})`);
}
