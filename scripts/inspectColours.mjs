import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccountPath = 'C:\\Users\\mokks\\Downloads\\shufactory-cmd-1-firebase-adminsdk-fbsvc-889e0978ae.json';

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Service account file not found at: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function listCollectionsAndCounts() {
  const collections = await db.listCollections();
  console.log("=== Database Collections & Counts ===");
  for (const coll of collections) {
    const snap = await coll.get();
    console.log(`Collection: ${coll.id} (Documents: ${snap.size})`);
    if (coll.id === 'dailyProductions' || coll.id === 'production_colours' || coll.id === 'production_raw_materials') {
      // Just print counts
    } else {
      // Print some doc IDs
      const ids = snap.docs.map(d => d.id).slice(0, 5);
      console.log(`  Sample IDs: ${ids.join(', ')}`);
    }
  }
}

listCollectionsAndCounts();
