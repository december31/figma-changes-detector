const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// 1. Raw SVG for Figma with Changes badge in native 38x57 coordinates
const FIGMA_WITH_CHANGES_38x57 = `
<svg width="38" height="57" viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Top Left: Red-Orange -->
  <path d="M0 9.5C0 4.25329 4.25329 0 9.5 0H19V19H9.5C4.25329 19 0 14.7467 0 9.5Z" fill="#F24E1E" />
  <!-- Top Right: Coral -->
  <path d="M19 0H28.5C33.7467 0 38 4.25329 38 9.5C38 14.7467 33.7467 19 28.5 19H19V0Z" fill="#FF7262" />
  <!-- Mid Left: Purple -->
  <path d="M0 28.5C0 23.2533 4.25329 19 9.5 19H19V38H9.5C4.25329 38 0 33.7467 0 28.5Z" fill="#A259FF" />
  <!-- Mid Right: Blue/Cyan -->
  <circle cx="28.5" cy="28.5" r="9.5" fill="#1ABCFE" />
  <!-- Bottom Left: Green -->
  <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83" />
  <!-- Bottom Right: Changes Circle Badge (Figma Amber/Yellow #FFC700) -->
  <circle cx="28.5" cy="47.5" r="9.5" fill="#FFC700" />
  <!-- Changes Icon: Sync/autorenew curved arrows in #18181B -->
  <g transform="translate(28.5, 47.5) scale(0.56) translate(-12, -12)" fill="#18181B">
    <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z" />
  </g>
</svg>
`.trim();

// 2. Square SVG centered on 64x64 transparent grid (Figma 38x57 centered: offset x=13, y=3.5)
const FIGMA_WITH_CHANGES_SQUARE_64x64 = `
<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(13, 3.5)">
    <!-- Top Left: Red-Orange -->
    <path d="M0 9.5C0 4.25329 4.25329 0 9.5 0H19V19H9.5C4.25329 19 0 14.7467 0 9.5Z" fill="#F24E1E" />
    <!-- Top Right: Coral -->
    <path d="M19 0H28.5C33.7467 0 38 4.25329 38 9.5C38 14.7467 33.7467 19 28.5 19H19V0Z" fill="#FF7262" />
    <!-- Mid Left: Purple -->
    <path d="M0 28.5C0 23.2533 4.25329 19 9.5 19H19V38H9.5C4.25329 38 0 33.7467 0 28.5Z" fill="#A259FF" />
    <!-- Mid Right: Blue/Cyan -->
    <circle cx="28.5" cy="28.5" r="9.5" fill="#1ABCFE" />
    <!-- Bottom Left: Green -->
    <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83" />
    <!-- Bottom Right: Changes Circle Badge (Figma Amber/Yellow #FFC700) -->
    <circle cx="28.5" cy="47.5" r="9.5" fill="#FFC700" />
    <!-- Changes Icon: Sync/autorenew curved arrows in #18181B -->
    <g transform="translate(28.5, 47.5) scale(0.56) translate(-12, -12)" fill="#18181B">
      <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z" />
    </g>
  </g>
</svg>
`.trim();

// 3. Apple Touch / Squircle desktop tile SVG (512x512)
const FIGMA_WITH_CHANGES_SQUIRCLE_512 = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="tileBg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop stop-color="#1E2330" />
      <stop offset="1" stop-color="#0E1118" />
    </linearGradient>
    <linearGradient id="tileBorder" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop stop-color="#3B4252" stop-opacity="0.8" />
      <stop offset="1" stop-color="#1E222D" stop-opacity="0.2" />
    </linearGradient>
    <filter id="tileShadow" x="0" y="0" width="512" height="512" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000000" flood-opacity="0.45" />
    </filter>
  </defs>
  <!-- Squircle rounded background -->
  <rect x="24" y="24" width="464" height="464" rx="108" fill="url(#tileBg)" stroke="url(#tileBorder)" stroke-width="3" />
  <g transform="translate(122, 59) scale(7.05)" filter="url(#tileShadow)">
    <path d="M0 9.5C0 4.25329 4.25329 0 9.5 0H19V19H9.5C4.25329 19 0 14.7467 0 9.5Z" fill="#F24E1E" />
    <path d="M19 0H28.5C33.7467 0 38 4.25329 38 9.5C38 14.7467 33.7467 19 28.5 19H19V0Z" fill="#FF7262" />
    <path d="M0 28.5C0 23.2533 4.25329 19 9.5 19H19V38H9.5C4.25329 38 0 33.7467 0 28.5Z" fill="#A259FF" />
    <circle cx="28.5" cy="28.5" r="9.5" fill="#1ABCFE" />
    <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83" />
    <circle cx="28.5" cy="47.5" r="9.5" fill="#FFC700" />
    <g transform="translate(28.5, 47.5) scale(0.56) translate(-12, -12)" fill="#18181B">
      <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z" />
    </g>
  </g>
</svg>
`.trim();

/**
 * Packs multiple PNG buffers into a valid multi-resolution Windows .ico file
 */
function createIcoFromPngs(pngBuffersWithSizes) {
  const count = pngBuffersWithSizes.length;
  const headerSize = 6 + (16 * count);
  let currentOffset = headerSize;
  const entries = [];

  for (let i = 0; i < count; i++) {
    const { size, buffer } = pngBuffersWithSizes[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height (0 = 256)
    entry.writeUInt8(0, 2);                      // color palette count
    entry.writeUInt8(0, 3);                      // reserved
    entry.writeUInt16LE(1, 4);                   // color planes
    entry.writeUInt16LE(32, 6);                  // bpp (32-bit RGBA)
    entry.writeUInt32LE(buffer.length, 8);       // image byte size
    entry.writeUInt32LE(currentOffset, 12);      // byte offset
    entries.push(entry);
    currentOffset += buffer.length;
  }

  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0);
  icoHeader.writeUInt16LE(1, 2); // 1 = ICO format
  icoHeader.writeUInt16LE(count, 4);

  return Buffer.concat([icoHeader, ...entries, ...pngBuffersWithSizes.map(p => p.buffer)]);
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const buildDir = path.join(rootDir, 'build');
  const clientPublicDir = path.join(rootDir, 'client', 'public');
  const serverPublicDir = path.join(rootDir, 'server', 'public');

  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(clientPublicDir, { recursive: true });
  fs.mkdirSync(serverPublicDir, { recursive: true });

  console.log('Generating icon assets...');

  const squareSvgBuf = Buffer.from(FIGMA_WITH_CHANGES_SQUARE_64x64);
  const squircleSvgBuf = Buffer.from(FIGMA_WITH_CHANGES_SQUIRCLE_512);

  // 1. Generate PNGs across standard sizes
  const sizes = [16, 24, 32, 48, 64, 128, 180, 192, 256, 512];
  const pngBuffers = {};

  for (const s of sizes) {
    pngBuffers[s] = await sharp(squareSvgBuf, { density: 300 })
      .resize(s, s)
      .png()
      .toBuffer();
  }

  // Apple touch icon (squircle for beautiful iOS/mobile home screen display)
  const appleTouchIconBuf = await sharp(squircleSvgBuf, { density: 300 })
    .resize(180, 180)
    .png()
    .toBuffer();

  const squircle512Buf = await sharp(squircleSvgBuf, { density: 300 })
    .resize(512, 512)
    .png()
    .toBuffer();

  // 2. Generate multi-resolution ICO for Windows / Electron
  // Standard Windows ICO sizes: 16, 24, 32, 48, 64, 128, 256
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoItems = icoSizes.map(s => ({ size: s, buffer: pngBuffers[s] }));
  const electronIco = createIcoFromPngs(icoItems);

  // Favicon ICO (16, 32, 48)
  const faviconIcoItems = [16, 32, 48].map(s => ({ size: s, buffer: pngBuffers[s] }));
  const faviconIco = createIcoFromPngs(faviconIcoItems);

  // 3. Write Electron Build assets
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), electronIco);
  fs.writeFileSync(path.join(buildDir, 'icon.png'), pngBuffers[512]);
  fs.writeFileSync(path.join(buildDir, 'icon-256.png'), pngBuffers[256]);
  fs.writeFileSync(path.join(buildDir, 'icon-squircle.png'), squircle512Buf);
  fs.writeFileSync(path.join(buildDir, 'icon.svg'), squareSvgBuf);
  console.log('✓ Created build/ assets for Electron (icon.ico, icon.png, icon-squircle.png, icon.svg)');

  // 4. Write Web Client Public assets
  fs.writeFileSync(path.join(clientPublicDir, 'favicon.svg'), squareSvgBuf);
  fs.writeFileSync(path.join(clientPublicDir, 'favicon.ico'), faviconIco);
  fs.writeFileSync(path.join(clientPublicDir, 'favicon-16x16.png'), pngBuffers[16]);
  fs.writeFileSync(path.join(clientPublicDir, 'favicon-32x32.png'), pngBuffers[32]);
  fs.writeFileSync(path.join(clientPublicDir, 'favicon-48x48.png'), pngBuffers[48]);
  fs.writeFileSync(path.join(clientPublicDir, 'apple-touch-icon.png'), appleTouchIconBuf);
  fs.writeFileSync(path.join(clientPublicDir, 'icon-192.png'), pngBuffers[192]);
  fs.writeFileSync(path.join(clientPublicDir, 'icon-512.png'), pngBuffers[512]);
  console.log('✓ Created client/public/ assets for Web');

  // 5. Write Server Public assets (for fallback/static serving)
  fs.writeFileSync(path.join(serverPublicDir, 'favicon.svg'), squareSvgBuf);
  fs.writeFileSync(path.join(serverPublicDir, 'favicon.ico'), faviconIco);
  fs.writeFileSync(path.join(serverPublicDir, 'favicon-32x32.png'), pngBuffers[32]);
  fs.writeFileSync(path.join(serverPublicDir, 'apple-touch-icon.png'), appleTouchIconBuf);
  console.log('✓ Created server/public/ fallback assets');

  console.log('\nAll app icons successfully generated!');
}

main().catch(err => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
