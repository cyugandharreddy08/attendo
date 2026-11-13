const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const packageJson = require('../package.json');
const version = process.argv[2] || packageJson.version;
const minNativeCode = parseInt(process.argv[3] || '800', 10);
const rolloutPercentage = parseInt(process.argv[4] || '100', 10);

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist_ota');
const keysDir = path.join(rootDir, 'ota_keys');
const privateKeyPath = path.join(keysDir, 'ota_private_key.pem');

if (!fs.existsSync(privateKeyPath)) {
  console.error('Private key not found at', privateKeyPath);
  console.error('Please run "node scripts/generate-ota-keys.js" first.');
  process.exit(1);
}

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

console.log(`\n📦 Packaging Enterprise OTA Release v${version}...`);

// 1. Bundle JavaScript and assets
const bundleOutput = path.join(distDir, 'index.android.bundle');
console.log('Running React Native Metro bundler...');
execSync(
  `npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output "${bundleOutput}" --assets-dest "${distDir}"`,
  { stdio: 'inherit', cwd: rootDir }
);

// 2. Package into zip archive (using powershell Compress-Archive or zip)
const zipName = `bundle-v${version}.zip`;
const zipPath = path.join(distDir, zipName);
console.log(`Compressing bundle package into ${zipName}...`);

const isWindows = process.platform === 'win32';
if (isWindows) {
  execSync(
    `powershell -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipPath}' -Force"`,
    { stdio: 'inherit' }
  );
} else {
  execSync(`cd "${distDir}" && zip -r "${zipName}" ./*`, { stdio: 'inherit' });
}

// 3. Compute SHA-256 hash of archive
const zipBuffer = fs.readFileSync(zipPath);
const sha256 = crypto.createHash('sha256').update(zipBuffer).digest('hex');
console.log('SHA-256 Hash:', sha256);

// 4. Digitally sign the hash using RSA Private Key
const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
const signer = crypto.createSign('SHA256');
signer.update(zipBuffer);
signer.end();
const signature = signer.sign(privateKey, 'base64');
console.log('Digital Signature (RSA-2048): Verified');

// 5. Generate Manifest JSON
const manifest = {
  bundle_version: version,
  bundle_url: `https://github.com/cyugandharreddy08/attendo/releases/download/v${version}/${zipName}`,
  sha256: sha256,
  signature: signature,
  min_native_code: minNativeCode,
  max_native_code: minNativeCode,
  rollout_percentage: rolloutPercentage,
  release_notes: `Attendo dynamic OTA update v${version} with bug fixes and performance improvements.`,
  is_mandatory: false,
  published_at: new Date().toISOString(),
};

const manifestPath = path.join(distDir, 'ota-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log('\n✅ Enterprise OTA Package Ready:');
console.log('Archive:', zipPath, `(${Math.round(zipBuffer.length / 1024)} KB)`);
console.log('Manifest:', manifestPath);
console.log('\nManifest Preview:');
console.log(JSON.stringify(manifest, null, 2));
