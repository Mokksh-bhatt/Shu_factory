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

// Seeds data mirroring the PDF structure for FY 2024-25
const seedData = [
  // Glazes & Powders
  { name: "Glass Powder", type: "OPENING", qty: 1000, date: "2024-04-01", rate: 28.11 },
  { name: "Glass Powder", type: "INWARD", qty: 5000, date: "2024-08-10", rate: 28.11 },
  
  { name: "Quartz Powder for Matte", type: "OPENING", qty: 5000, date: "2024-04-01", rate: 3.25 },
  { name: "Quartz Powder for Matte", type: "INWARD", qty: 20000, date: "2024-05-18", rate: 3.25 },

  { name: "Quartz Powder for Polishing", type: "OPENING", qty: 6000, date: "2024-04-01", rate: 3.25 },
  { name: "Quartz Powder for Polishing", type: "INWARD", qty: 25000, date: "2024-06-22", rate: 3.25 },

  { name: "Ball Clay Powder", type: "OPENING", qty: 8000, date: "2024-04-01", rate: 5.70 },
  { name: "Ball Clay Powder", type: "INWARD", qty: 30000, date: "2024-11-12", rate: 5.70 },

  // Stains
  { name: "G Blue Stain", type: "OPENING", qty: 50, date: "2024-04-01", rate: 664.85 },
  { name: "G Blue Stain", type: "INWARD", qty: 200, date: "2024-06-15", rate: 664.85 },

  { name: "Black Stain", type: "OPENING", qty: 30, date: "2024-04-01", rate: 2052.50 },
  { name: "Black Stain", type: "INWARD", qty: 100, date: "2024-09-12", rate: 2052.50 },

  { name: "Cherry Red Stain", type: "OPENING", qty: 15, date: "2024-04-01", rate: 2269.22 },
  { name: "Cherry Red Stain", type: "INWARD", qty: 50, date: "2024-07-08", rate: 2269.22 },

  // Chemicals
  { name: "Zirconium", type: "OPENING", qty: 200, date: "2024-04-01", rate: 235.00 },
  { name: "Zirconium", type: "INWARD", qty: 1000, date: "2024-09-05", rate: 235.00 },

  { name: "PVA", type: "OPENING", qty: 300, date: "2024-04-01", rate: 202.00 },
  { name: "PVA", type: "INWARD", qty: 1500, date: "2024-07-20", rate: 202.00 },

  { name: "Zinc Oxide", type: "OPENING", qty: 150, date: "2024-04-01", rate: 105.87 },
  { name: "Barium Carbonate", type: "OPENING", qty: 400, date: "2024-04-01", rate: 30.73 },
  { name: "Chrome Oxide", type: "OPENING", qty: 100, date: "2024-04-01", rate: 359.61 },

  // Packaging
  { name: "Corrugated Boxes", type: "OPENING", qty: 500, date: "2024-04-01", rate: 526.42 },
  { name: "Corrugated Boxes", type: "INWARD", qty: 2000, date: "2024-10-02", rate: 526.42 },

  { name: "Plastic Bags", type: "OPENING", qty: 1000, date: "2024-04-01", rate: 0.85 },
  { name: "Plastic Bags", type: "INWARD", qty: 5000, date: "2024-05-10", rate: 0.85 }
];

async function seedStockTransactions() {
  try {
    console.log("=== Seeding Inventory Transactions in Firestore ===");

    // Fetch all materials
    const rmSnap = await db.collection('production_raw_materials').get();
    const rmMap = new Map();
    rmSnap.forEach(doc => {
      rmMap.set(doc.data().name?.trim(), doc.id);
    });

    let successCount = 0;

    for (const item of seedData) {
      const matId = rmMap.get(item.name);
      if (matId) {
        const val = item.qty * item.rate;
        await db.collection('inventory_transactions').add({
          rawMaterialId: matId,
          type: item.type,
          date: item.date,
          quantity: item.qty,
          rate: item.rate,
          value: val,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Seeded transaction: ${item.name} | ${item.type} | ${item.qty} units | Date: ${item.date}`);
        successCount++;
      } else {
        console.log(`Warning: Raw material '${item.name}' not found in database (skipping).`);
      }
    }

    console.log(`\n=== Seeding Completed! Successful Entries: ${successCount}/${seedData.length} ===`);
  } catch (error) {
    console.error("Error seeding stock transactions:", error);
  } finally {
    process.exit(0);
  }
}

seedStockTransactions();
