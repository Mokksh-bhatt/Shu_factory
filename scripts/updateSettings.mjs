import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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
  const serviceAccountPath = readEnv('GOOGLE_APPLICATION_CREDENTIALS');
  const serviceAccount = loadServiceAccount(serviceAccountPath);

  initializeApp({
    credential: cert(serviceAccount),
  });

  const db = getFirestore();
  
  const settingsRef = db.collection('config').doc('appSettings');
  
  const payload = {
    minVersionCode: 3,
    latestVersionName: "Version 9.0",
    apkUrl: "https://shufactory-cmd-1.web.app/update.apk"
  };

  await settingsRef.set(payload, { merge: true });

  console.log('Successfully updated Firestore config/appSettings with:');
  console.log(JSON.stringify(payload, null, 2));
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
