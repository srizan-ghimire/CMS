import { createHash, randomBytes } from "crypto";

/**
 * RFC 7636 PKCE helpers. TikTok's OAuth v2 API requires S256 code challenges (hex-encoded,
 * per TikTok's docs — not the base64url encoding most other providers use), so this isn't a
 * generic PKCE util shared across providers; it's specifically shaped for TikTok.
 */

const UNRESERVED_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

export function generateCodeVerifier(length = 64): string {
  if (length < 43 || length > 128) {
    throw new Error("PKCE code_verifier length must be between 43 and 128 characters");
  }
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    const byte = bytes[i] ?? 0;
    result += UNRESERVED_CHARS[byte % UNRESERVED_CHARS.length];
  }
  return result;
}

/** TikTok expects the code_challenge as the hex digest of SHA-256(code_verifier), not base64url. */
export function deriveTikTokCodeChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("hex");
}
