const path = require('path');
const fs = require('fs');

let sharp = null;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('Sharp not available, fallback to full image:', e.message);
}

const rootDir = path.resolve(__dirname, '..', '..');
const assetsDir = path.join(rootDir, 'assets');
const thumbnailsDir = path.join(assetsDir, 'thumbnails');
fs.mkdirSync(thumbnailsDir, { recursive: true });

/**
 * Returns the relative web path (/assets/thumbnails/...) for a thumbnail,
 * creating it on disk if it doesn't already exist.
 */
async function getOrCreateThumbnail(imageRelPath, targetSize = 96) {
  if (!imageRelPath) return null;
  const cleanRel = imageRelPath.replace(/^\//, '');
  const fullSourcePath = path.join(rootDir, cleanRel);

  if (!fs.existsSync(fullSourcePath)) {
    return null;
  }

  // If sharp not available or SVG/PDF, return original path
  if (!sharp || cleanRel.endsWith('.svg') || cleanRel.endsWith('.pdf')) {
    return imageRelPath;
  }

  const filename = path.basename(cleanRel);
  const thumbFilename = `thumb_${targetSize}_${filename}`;
  const thumbDiskPath = path.join(thumbnailsDir, thumbFilename);

  if (fs.existsSync(thumbDiskPath)) {
    return `/assets/thumbnails/${thumbFilename}`;
  }

  try {
    await sharp(fullSourcePath)
      .resize(targetSize, targetSize, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png({ quality: 80, compressionLevel: 8 })
      .toFile(thumbDiskPath);

    return `/assets/thumbnails/${thumbFilename}`;
  } catch (err) {
    console.warn(`Failed to generate thumbnail for ${cleanRel}:`, err.message);
    return imageRelPath;
  }
}

/**
 * Batch generate thumbnails for all snapshot files in /assets/snapshots
 */
async function generateAllThumbnails(targetSize = 96) {
  const snapshotsDir = path.join(assetsDir, 'snapshots');
  if (!fs.existsSync(snapshotsDir)) return 0;

  const files = fs.readdirSync(snapshotsDir);
  let count = 0;
  for (const file of files) {
    if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')) {
      const relPath = `/assets/snapshots/${file}`;
      await getOrCreateThumbnail(relPath, targetSize);
      count++;
    }
  }
  return count;
}

module.exports = {
  getOrCreateThumbnail,
  generateAllThumbnails,
  thumbnailsDir,
  rootDir
};
