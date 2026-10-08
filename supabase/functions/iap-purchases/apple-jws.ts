// StoreKit 2 signed transaction (JWS) verification.
// Verifies the x5c chain up to the pinned Apple Root CA - G3 and the ES256 signature.
import * as x509 from "npm:@peculiar/x509@1.12.3";

x509.cryptoProvider.set(crypto);

// SHA-256 of https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
const APPLE_ROOT_G3_SHA256 = "63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179";
const LEAF_OID = "1.2.840.113635.100.6.11.1";
const INTERMEDIATE_OID = "1.2.840.113635.100.6.2.1";

export interface AppleTransaction {
  transactionId: string;
  originalTransactionId?: string;
  bundleId: string;
  productId: string;
  environment: string; // "Production" | "Sandbox"
  revocationDate?: number;
  expiresDate?: number;
  type?: string;
  appAccountToken?: string;
  [k: string]: unknown;
}

const b64urlToBytes = (s: string) => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};
const b64ToBytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export const looksLikeJws = (token: string) => {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    return Array.isArray(header?.x5c);
  } catch {
    return false;
  }
};

export async function verifyAppleSignedTransaction(jws: string): Promise<AppleTransaction> {
  const [h, p, s] = jws.split(".");
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
  if (header.alg !== "ES256") throw new Error("Apple verification failed: unsupported alg");
  const x5c: string[] = header.x5c;
  if (!Array.isArray(x5c) || x5c.length !== 3) throw new Error("Apple verification failed: bad certificate chain");

  const [leaf, inter, root] = x5c.map((c) => new x509.X509Certificate(b64ToBytes(c)));

  const rootHash = hex(await crypto.subtle.digest("SHA-256", root.rawData));
  if (rootHash !== APPLE_ROOT_G3_SHA256) throw new Error("Apple verification failed: untrusted root");

  const now = new Date();
  for (const c of [leaf, inter, root]) {
    if (now < c.notBefore || now > c.notAfter) throw new Error("Apple verification failed: certificate expired");
  }
  if (!leaf.getExtension(LEAF_OID)) throw new Error("Apple verification failed: invalid leaf certificate");
  if (!inter.getExtension(INTERMEDIATE_OID)) throw new Error("Apple verification failed: invalid intermediate certificate");

  const interOk = await inter.verify({ publicKey: root.publicKey, signatureOnly: true });
  const leafOk = await leaf.verify({ publicKey: inter.publicKey, signatureOnly: true });
  if (!interOk || !leafOk) throw new Error("Apple verification failed: chain signature invalid");

  const key = await leaf.publicKey.export({ name: "ECDSA", namedCurve: "P-256" }, ["verify"]);
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    b64urlToBytes(s),
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!ok) throw new Error("Apple verification failed: signature invalid");

  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p))) as AppleTransaction;
  if (!payload?.transactionId || !payload?.productId) throw new Error("Apple verification failed: incomplete transaction");
  return payload;
}
