import crypto from "crypto";

export class EncryptionService {
  private static readonly ALGORITHM = "aes-256-gcm";

  private static readonly IV_LENGTH = 16;

  static encrypt(text: string, masterKey: string): string {
    if (!masterKey || masterKey.length !== 64) {
      throw new Error("Master key must be 64 hex characters (32 bytes)");
    }

    const iv = crypto.randomBytes(this.IV_LENGTH);
    const key = Buffer.from(masterKey, "hex");
    const cipher = crypto.createCipheriv(
      this.ALGORITHM,
      key as crypto.CipherKey,
      iv as crypto.BinaryLike
    );

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  }

  static decrypt(encryptedText: string, masterKey: string): string {
    if (!masterKey || masterKey.length !== 64) {
      throw new Error("Master key must be 64 hex characters (32 bytes)");
    }

    const parts = encryptedText.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted text format");
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const key = Buffer.from(masterKey, "hex");

    const decipher = crypto.createDecipheriv(
      this.ALGORITHM,
      key as crypto.CipherKey,
      iv as crypto.BinaryLike
    );
    (decipher as any).setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}
