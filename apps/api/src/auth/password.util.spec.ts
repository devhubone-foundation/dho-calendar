import { hashPassword, verifyPassword } from "./password.util";

describe("password.util (real argon2id hashing)", () => {
  it("hashes a password as argon2id and verifies it correctly", async () => {
    const hash = await hashPassword("a-correct-horse-battery-staple");
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(hash, "a-correct-horse-battery-staple")).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("the-real-password");
    await expect(verifyPassword(hash, "not-the-real-password")).resolves.toBe(false);
  });

  it("produces a different hash for the same password on each call (random salt)", async () => {
    const first = await hashPassword("same-input-password");
    const second = await hashPassword("same-input-password");
    expect(first).not.toBe(second);
  });
});
