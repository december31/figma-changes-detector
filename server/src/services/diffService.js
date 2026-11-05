const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { PNG } = require('pngjs');
const pixelmatchModule = require('pixelmatch');
const pixelmatch = pixelmatchModule.default || pixelmatchModule;

const rootDir = path.resolve(__dirname, '..', '..');

function padPngToSize(png, targetWidth, targetHeight) {
  if (png.width === targetWidth && png.height === targetHeight) {
    return png.data;
  }
  const padded = new PNG({ width: targetWidth, height: targetHeight });
  padded.data.fill(0);
  PNG.bitblt(png, padded, 0, 0, png.width, png.height, 0, 0);
  return padded.data;
}

/**
 * Compares previous image and new image buffer.
 * Returns comparison metrics (pixel diff count, percentage, file hash, width, height).
 */
function compareWithPreviousFetch(prevFetch, currentBuffer, format) {
  const currentHash = crypto.createHash('sha256').update(currentBuffer).digest('hex');
  let width = 0;
  let height = 0;
  let currentPng = null;

  if (format === 'png') {
    try {
      currentPng = PNG.sync.read(currentBuffer);
      width = currentPng.width;
      height = currentPng.height;
    } catch (e) {
      console.warn('Could not decode current PNG:', e.message);
    }
  }

  // First time fetching this component -> Baseline
  if (!prevFetch) {
    return {
      fileHash: currentHash,
      width,
      height,
      hasChanges: 0,
      changeStatus: 'baseline',
      diffPixels: 0,
      diffPercentage: 0,
      diffImagePath: null,
      previousFetchId: null
    };
  }

  // Fast path: identical SHA-256 hash means 0 changes
  if (prevFetch.file_hash === currentHash) {
    return {
      fileHash: currentHash,
      width: width || (prevFetch && prevFetch.width) || 0,
      height: height || (prevFetch && prevFetch.height) || 0,
      hasChanges: 0,
      changeStatus: 'unchanged',
      diffPixels: 0,
      diffPercentage: 0,
      diffImagePath: null,
      previousFetchId: prevFetch.id
    };
  }

  // If both are PNG and previous file exists on disk, perform pixel-by-pixel comparison
  const prevDiskPath = path.join(rootDir, prevFetch.image_path.replace(/^\//, ''));
  if (format === 'png' && currentPng && fs.existsSync(prevDiskPath)) {
    try {
      const prevBuffer = fs.readFileSync(prevDiskPath);
      const prevPng = PNG.sync.read(prevBuffer);

      const maxWidth = Math.max(prevPng.width, currentPng.width);
      const maxHeight = Math.max(prevPng.height, currentPng.height);

      const img1Data = padPngToSize(prevPng, maxWidth, maxHeight);
      const img2Data = padPngToSize(currentPng, maxWidth, maxHeight);

      const diffPixels = pixelmatch(img1Data, img2Data, null, maxWidth, maxHeight, {
        threshold: 0.1,
        includeAA: true
      });

      const totalPixels = maxWidth * maxHeight;
      const diffPercentage = totalPixels > 0 ? Number(((diffPixels / totalPixels) * 100).toFixed(4)) : 0;

      if (diffPixels === 0 && prevPng.width === currentPng.width && prevPng.height === currentPng.height) {
        return {
          fileHash: currentHash,
          width,
          height,
          hasChanges: 0,
          changeStatus: 'unchanged',
          diffPixels: 0,
          diffPercentage: 0,
          diffImagePath: null,
          previousFetchId: prevFetch.id
        };
      }

      return {
        fileHash: currentHash,
        width,
        height,
        hasChanges: 1,
        changeStatus: 'changed',
        diffPixels,
        diffPercentage,
        diffImagePath: null,
        previousFetchId: prevFetch.id
      };
    } catch (err) {
      console.warn('Pixel comparison fallback to hash comparison:', err.message);
    }
  }

  // Fallback for non-PNG (SVG/JPG/PDF) where hash differed
  return {
    fileHash: currentHash,
    width,
    height,
    hasChanges: 1,
    changeStatus: 'changed',
    diffPixels: 0,
    diffPercentage: 100,
    diffImagePath: null,
    previousFetchId: prevFetch.id
  };
}

module.exports = {
  compareWithPreviousFetch
};
