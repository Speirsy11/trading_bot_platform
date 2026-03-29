import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { AppError, AppErrorCode } from "../utils/errors.js";

const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export class KeyVault {
  private readonly key: Buffer;

  constructor(secret?: string) {
    const material = secret ?? "development-only-encryption-key-change-me";
    this.key = createHash("sha256").update(material).digest();
  }

  encrypt(plainText: string | null | undefined): string | null {
    if (!plainText) {
      return null;
    }

    try {
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv("aes-256-gcm", this.key, iv);
      const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
      const authTag = cipher.getAuthTag();
      return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
    } catch (error) {
      throw new AppError(AppErrorCode.ENCRYPTION_ERROR, "Failed to encrypt secret", 500, error);
    }
  }

  decrypt(payload: string | null | undefined): string | null {
    if (!payload) {
      return null;
    }

    try {
      const buffer = Buffer.from(payload, "base64");
      const iv = buffer.subarray(0, IV_LENGTH);
      const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const ciphertext = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
      const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch (error) {
      throw new AppError(AppErrorCode.ENCRYPTION_ERROR, "Failed to decrypt secret", 500, error);
    }
  }
}
