import { describe, expect, it } from "vitest";

import { KeyVault } from "./keyVault.js";

describe("KeyVault", () => {
  it("encrypts and decrypts values with a stable secret", () => {
    const vault = new KeyVault("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");

    const encrypted = vault.encrypt("top-secret-value");

    expect(encrypted).not.toBe("top-secret-value");
    expect(vault.decrypt(encrypted)).toBe("top-secret-value");
  });

  it("throws when decrypting tampered ciphertext", () => {
    const vault = new KeyVault("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
    const encrypted = vault.encrypt("top-secret-value")!;
    const tampered = `${encrypted.slice(0, -2)}aa`;

    expect(() => vault.decrypt(tampered)).toThrow("Failed to decrypt secret");
  });
});
