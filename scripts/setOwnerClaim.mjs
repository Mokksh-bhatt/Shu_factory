import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'node:fs';
import path from 'node:path';

function readEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

function loadServiceAccount(filePath) {
  const absolute = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Service account file not found: ${absolute}`);
  }
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

async function run() {
  const ownerEmail = readEnv('OWNER_EMAIL').trim().toLowerCase();
  const serviceAccountPath = readEnv('GOOGLE_APPLICATION_CREDENTIALS');

  const serviceAccount = loadServiceAccount(serviceAccountPath);

  initializeApp({
    credential: cert(serviceAccount),
  });

  const auth = getAuth();
  const user = await auth.getUserByEmail(ownerEmail);
  await auth.setCustomUserClaims(user.uid, { role: 'owner' });

  console.log(`Set custom claim role=owner for ${ownerEmail} (uid: ${user.uid})`);
  console.log('Ask the owner to sign out and sign in again to refresh token claims.');
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
