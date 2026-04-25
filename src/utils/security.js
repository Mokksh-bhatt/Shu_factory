const textEncoder = new TextEncoder();

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function isValidWorkerName(name) {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 40;
}

export function isStrongEnoughPassword(password) {
  return typeof password === 'string' && password.trim().length >= 4;
}

export async function hashPassword(password, saltBase64 = null) {
  const salt = saltBase64 ? base64ToBytes(saltBase64) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', textEncoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);

  const iterations = 120000;
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    keyMaterial,
    256,
  );

  return {
    algorithm: 'PBKDF2-SHA256',
    iterations,
    salt: bytesToBase64(salt),
    hash: bytesToBase64(new Uint8Array(derivedBits)),
  };
}

export async function verifyPassword(password, passwordHashObj) {
  if (!passwordHashObj?.salt || !passwordHashObj?.hash) return false;
  const recomputed = await hashPassword(password, passwordHashObj.salt);
  return recomputed.hash === passwordHashObj.hash;
}
