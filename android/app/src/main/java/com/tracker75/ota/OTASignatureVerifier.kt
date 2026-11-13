package com.tracker75.ota

import android.util.Base64
import java.io.File
import java.io.FileInputStream
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.PublicKey
import java.security.Signature
import java.security.spec.X509EncodedKeySpec

/**
 * Enterprise Cryptographic Verification Engine for Attendo OTA Updates.
 * Verifies SHA-256 payload digest and RSA-2048 digital signature against the embedded public key.
 */
object OTASignatureVerifier {

    // Embedded RSA-2048 Public Key (SPKI X.509 format)
    private const val EMBEDDED_PUBLIC_KEY_BASE64 =
        "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt87rP+vUjGSFgDmqpMj9" +
        "tPN6+9U6abx7Au85UOpKWnUVa566TUsncZP8j2QYQ/xK8WjLxWNR5lO64NgfZj0q" +
        "7sFQ0qZ9TgN0yLMeokcsKFox2kGJf+bA4qtpBGKPb9Gm1bryoNoZZKbSWCLvSv60" +
        "VWkVQI9Mh7VtRS1cyqc2JCrNtHkY5XLpoWFifmZpxOuA0tKVbFJukWWXorSjZ5VO" +
        "H2nSsPLGOp3yU21aRWaAER7cxixprNmosSCr21KuPXOE/JuAbCD/nK28gwbTWfr2" +
        "nTkeYmoy9V3/KLtdqTARQOf0bewxzh5tUDcwjyJWQUkkC6FdH93ej1EQ8RjvI1/Z" +
        "2wIDAQAB"

    private var cachedPublicKey: PublicKey? = null

    @Synchronized
    private fun getPublicKey(): PublicKey {
        if (cachedPublicKey != null) return cachedPublicKey!!

        val keyBytes = Base64.decode(EMBEDDED_PUBLIC_KEY_BASE64, Base64.DEFAULT)
        val spec = X509EncodedKeySpec(keyBytes)
        val kf = KeyFactory.getInstance("RSA")
        val pk = kf.generatePublic(spec)
        cachedPublicKey = pk
        return pk
    }

    /**
     * Computes the SHA-256 hash of a file as a lowercase hexadecimal string.
     */
    fun computeSHA256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { fis ->
            val buffer = ByteArray(8192)
            var bytesRead: Int
            while (fis.read(buffer).also { bytesRead = it } != -1) {
                digest.update(buffer, 0, bytesRead)
            }
        }
        val hashBytes = digest.digest()
        return hashBytes.joinToString("") { "%02x".format(it) }
    }

    /**
     * Verifies that the file matches the expected SHA-256 hash.
     */
    fun verifyChecksum(file: File, expectedHash: String): Boolean {
        if (!file.exists() || !file.isFile) return false
        val computed = computeSHA256(file)
        return computed.equals(expectedHash.trim(), ignoreCase = true)
    }

    /**
     * Verifies that the file's digital signature matches the embedded RSA public key.
     * The signature is expected to be a Base64-encoded string of the SHA-256 digest signed with RSA.
     */
    fun verifySignature(file: File, signatureBase64: String): Boolean {
        if (!file.exists() || !file.isFile) return false

        return try {
            val pubKey = getPublicKey()
            val sig = Signature.getInstance("SHA256withRSA")
            sig.initVerify(pubKey)

            FileInputStream(file).use { fis ->
                val buffer = ByteArray(8192)
                var bytesRead: Int
                while (fis.read(buffer).also { bytesRead = it } != -1) {
                    sig.update(buffer, 0, bytesRead)
                }
            }

            val sigBytes = Base64.decode(signatureBase64.trim(), Base64.DEFAULT)
            sig.verify(sigBytes)
        } catch (e: Exception) {
            android.util.Log.e("OTASignatureVerifier", "Cryptographic signature verification failed: ${e.message}")
            false
        }
    }
}
