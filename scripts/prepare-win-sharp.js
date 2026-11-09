const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetDir = path.join(__dirname, '..', 'node_modules', '@img', 'sharp-win32-x64');
const targetFile = path.join(targetDir, 'lib', 'libvips-42.dll');

const serverImgDir = path.join(__dirname, '..', 'server', 'node_modules', '@img');
if (fs.existsSync(serverImgDir)) {
  const serverTarget = path.join(serverImgDir, 'sharp-win32-x64');
  try {
    fs.cpSync(targetDir, serverTarget, { recursive: true });
  } catch (e) {}
}

if (fs.existsSync(targetFile)) {
  console.log('✓ Windows sharp prebuilt binaries already present.');
  process.exit(0);
}

console.log('Downloading Windows sharp prebuilt binaries for packaging...');
fs.mkdirSync(targetDir, { recursive: true });

const tmpTar = path.join(__dirname, '..', 'sharp-win32.tgz');
try {
  execSync('npm pack @img/sharp-win32-x64@0.35.5', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  const packedFile = path.join(__dirname, '..', 'img-sharp-win32-x64-0.35.5.tgz');
  execSync(`tar -xzf "${packedFile}" -C "${targetDir}" --strip-components=1`);
  fs.unlinkSync(packedFile);
  console.log('✓ Windows sharp prebuilt binaries installed successfully.');
} catch (err) {
  console.error('Failed to prepare Windows sharp binary:', err.message);
  process.exit(1);
}
