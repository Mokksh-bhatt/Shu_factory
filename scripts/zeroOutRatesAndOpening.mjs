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

async function main() {
  try {
    console.log("=== Setting all production_raw_materials currentRate to 0 ===");
    const rmSnap = await db.collection('production_raw_materials').get();
    console.log(`Found ${rmSnap.size} raw materials.`);
    
    let rmUpdated = 0;
    for (const doc of rmSnap.docs) {
      await db.collection('production_raw_materials').doc(doc.id).update({
        currentRate: 0
      });
      rmUpdated++;
    }
    console.log(`Updated currentRate to 0 for ${rmUpdated} raw materials.`);

    console.log("=== Setting all inventory_transactions of type OPENING to 0 ===");
    const txSnap = await db.collection('inventory_transactions')
      .where('type', '==', 'OPENING')
      .get();
    console.log(`Found ${txSnap.size} OPENING transactions.`);
    
    let txUpdated = 0;
    for (const doc of txSnap.docs) {
      await db.collection('inventory_transactions').doc(doc.id).update({
        quantity: 0,
        rate: 0,
        value: 0
      });
      txUpdated++;
    }
    console.log(`Updated ${txUpdated} OPENING transactions to 0 quantity, rate, and value.`);
    
    console.log("=== Zero-out Database operations completed successfully ===");
  } catch (error) {
    console.error("Error zeroing out:", error);
  } finally {
    process.exit(0);
  }
}

main();
