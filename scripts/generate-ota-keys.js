const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const keysDir = path.join(__dirname, '..', 'ota_keys');
if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
}

const privateKeyPath = path.join(keysDir, 'ota_private_key.pem');
const publicKeyPath = path.join(keysDir, 'ota_public_key.pem');

if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
  console.log('OTA keys already exist at', keysDir);
  const pub = fs.readFileSync(publicKeyPath, 'utf8');
  console.log('Public Key:\n' + pub);
  process.exit(0);
}

console.log('Generating RSA-2048 keypair for Attendo Enterprise OTA...');
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
fs.writeFileSync(publicKeyPath, publicKey, { mode: 0o644 });

console.log('Keys generated successfully:');
console.log('Private key:', privateKeyPath);
console.log('Public key:', publicKeyPath);
console.log('\n--- PUBLIC KEY ---');
console.log(publicKey);
