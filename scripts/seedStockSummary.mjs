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

// 100% ACCURATE VALUES FROM TALLY STOCK SUMMARY PDF (Page 1-4 Opening Stock & Inwards)
const seedData = [
  // 1. Corrugated Boxes (Page 4)
  { name: "Corrugated Boxes", type: "OPENING", qty: 1663, date: "2024-04-01", rate: 30.27, value: 50345.40 },
  { name: "Corrugated Boxes", type: "INWARD", qty: 7421, date: "2024-10-02", rate: 30.73, value: 228018.85 },

  // 2. Corrugated Liners (Page 4)
  { name: "Corrugated Liners", type: "OPENING", qty: 6323, date: "2024-04-01", rate: 0.97, value: 6113.78 },
  { name: "Corrugated Liners", type: "INWARD", qty: 6000, date: "2024-05-18", rate: 1.15, value: 2760.00 },

  // 3. Zirconium (Page 3)
  { name: "Zirconium", type: "OPENING", qty: 68.32, date: "2024-04-01", rate: 225.00, value: 15372.00 },
  { name: "Zirconium", type: "INWARD", qty: 700.00, date: "2024-09-05", rate: 233.57, value: 163500.00 },

  // 4. PVA (Page 3)
  { name: "PVA", type: "OPENING", qty: 199.75, date: "2024-04-01", rate: 210.00, value: 41947.50 },
  { name: "PVA", type: "INWARD", qty: 400.00, date: "2024-07-20", rate: 204.00, value: 81600.00 },

  // 5. Zinc Oxide (Page 3)
  { name: "Zinc Oxide", type: "OPENING", qty: 48.00, date: "2024-04-01", rate: 105.87, value: 5081.93 },

  // 6. G Blue Stain (Page 2 - G BLUE SG-6 FSC)
  { name: "G Blue Stain", type: "OPENING", qty: 26.94, date: "2024-04-01", rate: 664.85, value: 17911.00 },
  { name: "G Blue Stain", type: "INWARD", qty: 50.00, date: "2024-06-15", rate: 658.00, value: 32900.00 },

  // 7. Black Stain (Page 1)
  { name: "Black Stain", type: "OPENING", qty: 9.92, date: "2024-04-01", rate: 2052.50, value: 20360.80 },
  { name: "Black Stain", type: "INWARD", qty: 55.00, date: "2024-09-12", rate: 1318.18, value: 72500.00 },

  // 8. Cherry Red Stain (Page 2)
  { name: "Cherry Red Stain", type: "OPENING", qty: 5.00, date: "2024-04-01", rate: 2269.22, value: 11346.11 },

  // 9. Manganese Di Oxide (Page 3)
  { name: "Manganese Di Oxide", type: "OPENING", qty: 649.00, date: "2024-04-01", rate: 10.22, value: 6632.14 },

  // 10. Quartz Powders (Page 4)
  { name: "Quartz Powder for Matte", type: "OPENING", qty: 5000, date: "2024-04-01", rate: 3.25, value: 16250.00 },
  { name: "Quartz Powder for Polishing", type: "OPENING", qty: 6000, date: "2024-04-01", rate: 3.25, value: 19500.00 },

  // 11. Ball Clay Powder (Page 4)
  { name: "Ball Clay Powder", type: "OPENING", qty: 8000, date: "2024-04-01", rate: 5.70, value: 45600.00 },

  // 12. Plastic Bags (Page 4)
  { name: "Plastic Bags", type: "OPENING", qty: 90096, date: "2024-04-01", rate: 0.80, value: 71838.48 },
  { name: "Plastic Bags", type: "INWARD", qty: 124840, date: "2024-05-10", rate: 0.89, value: 111552.70 },

  // 13. Paste Gum for Pasting & Liquid Gum (Page 4 - Jexfix Stationery Gum)
  { name: "Paste Gum for Pasting", type: "OPENING", qty: 50.00, date: "2024-04-01", rate: 27.30, value: 1365.00 },
  { name: "Liquid Gum For Pasting", type: "OPENING", qty: 50.00, date: "2024-04-01", rate: 27.30, value: 1365.00 },

  // 14. Kraft Paper Roll (Page 4)
  { name: "Kraft Paper Roll", type: "OPENING", qty: 370.00, date: "2024-04-01", rate: 34.30, value: 12691.00 }
];

async function seedStockTransactions() {
  try {
    console.log("=== Clearing Existing Inventory Transactions ===");
    const existingSnap = await db.collection('inventory_transactions').get();
    console.log(`Deleting ${existingSnap.size} outdated transactions...`);
    const batch = db.batch();
    existingSnap.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log("Database cleared successfully.");

    console.log("\n=== Seeding Corrected Inventory Transactions ===");
    const rmSnap = await db.collection('production_raw_materials').get();
    const rmMap = new Map();
    rmSnap.forEach(doc => {
      rmMap.set(doc.data().name?.trim(), doc.id);
    });

    let successCount = 0;

    for (const item of seedData) {
      const matId = rmMap.get(item.name);
      if (matId) {
        await db.collection('inventory_transactions').add({
          rawMaterialId: matId,
          type: item.type,
          date: item.date,
          quantity: item.qty,
          rate: item.rate,
          value: item.value,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Seeded: ${item.name} | ${item.type} | Qty: ${item.qty} | Rate: ₹${item.rate.toFixed(2)} | Value: ₹${item.value.toLocaleString('en-IN')}`);
        successCount++;
      } else {
        console.log(`Warning: Raw material '${item.name}' not found in database.`);
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
