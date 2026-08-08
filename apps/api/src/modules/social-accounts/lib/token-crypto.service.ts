import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, recommended for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts/decrypts OAuth access & refresh tokens before they're persisted. Ciphertext is stored
 * as `${iv}:${authTag}:${encrypted}`, each hex-encoded, so a single string column round-trips
 * cleanly through Prisma without a separate column per part.
 *
 * The key (ENCRYPTION_KEY, 32 raw bytes / 64 hex chars) never leaves this service — plaintext
 * tokens exist in memory only for the duration of an OAuth callback or an outbound publish call
 * and are never logged (see redact config in AppModule's LoggerModule).
 */
@Injectable()
export class TokenCryptoService {
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const hex = this.config.get<string>("encryptionKey");
    if (!hex || hex.length !== 64) {
      throw new Error(
        "ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes) — generate one with `openssl rand -hex 32`",
      );
    }
    this.key = Buffer.from(hex, "hex");
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, { authTagLength: AUTH_TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
  }

  decrypt(payload: string): string {
    const [ivHex, authTagHex, encryptedHex] = payload.split(":");
    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new Error("Malformed encrypted token payload");
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivHex, "hex"), {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  }
}
