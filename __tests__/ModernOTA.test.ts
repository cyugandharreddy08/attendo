import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

jest.mock('react-native-blob-util', () => ({
  fs: {
    dirs: { CacheDir: '/mock/cache' },
  },
  config: () => ({
    fetch: () => Promise.resolve({ info: () => ({ status: 200 }) }),
  }),
}));

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

import { computeRolloutBucket } from '../src/services/ModernOTAService';

describe('ModernOTAService Unit Tests', () => {
  describe('computeRolloutBucket', () => {
    it('produces deterministic bucket values for the same device ID', () => {
      const id = 'device-uuid-1234-abcd';
      const b1 = computeRolloutBucket(id);
      const b2 = computeRolloutBucket(id);
      expect(b1).toBe(b2);
      expect(b1).toBeGreaterThanOrEqual(0);
      expect(b1).toBeLessThan(100);
    });

    it('distributes different device IDs across 0-99 range', () => {
      const buckets = new Set<number>();
      for (let i = 0; i < 50; i++) {
        buckets.add(computeRolloutBucket(`device-${i}`));
      }
      expect(buckets.size).toBeGreaterThan(15);
    });
  });

  describe('Cryptographic Signature Verification', () => {
    const keysDir = path.join(__dirname, '..', 'ota_keys');
    const privateKeyPath = path.join(keysDir, 'ota_private_key.pem');
    const publicKeyPath = path.join(keysDir, 'ota_public_key.pem');

    it('successfully signs and verifies a sample payload using RSA-2048 SHA-256', () => {
      if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
        return; // Skip if keys not generated on CI
      }

      const privKey = fs.readFileSync(privateKeyPath, 'utf8');
      const pubKey = fs.readFileSync(publicKeyPath, 'utf8');

      const sampleBundle = Buffer.from('console.log("Attendo v8.0.1 OTA bundle");');

      // Sign with private key
      const signer = crypto.createSign('SHA256');
      signer.update(sampleBundle);
      signer.end();
      const signatureBase64 = signer.sign(privKey, 'base64');

      // Verify with public key
      const verifier = crypto.createVerify('SHA256');
      verifier.update(sampleBundle);
      verifier.end();
      const isValid = verifier.verify(pubKey, signatureBase64, 'base64');

      expect(isValid).toBe(true);
    });

    it('rejects tampered bundle content with mismatched signature', () => {
      if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
        return;
      }

      const privKey = fs.readFileSync(privateKeyPath, 'utf8');
      const pubKey = fs.readFileSync(publicKeyPath, 'utf8');

      const sampleBundle = Buffer.from('console.log("Original content");');
      const tamperedBundle = Buffer.from('console.log("Malicious modified content");');

      const signer = crypto.createSign('SHA256');
      signer.update(sampleBundle);
      signer.end();
      const signatureBase64 = signer.sign(privKey, 'base64');

      const verifier = crypto.createVerify('SHA256');
      verifier.update(tamperedBundle);
      verifier.end();
      const isValid = verifier.verify(pubKey, signatureBase64, 'base64');

      expect(isValid).toBe(false);
    });
  });
});
