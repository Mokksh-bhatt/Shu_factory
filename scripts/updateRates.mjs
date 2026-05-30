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

// Precise mapping based on Tally STOCK SUMMARY FY 2024-25.pdf
const ratesMap = {
  "G Blue Stain": 664.85,
  "Cherry Red Stain": 2269.22,
  "Mettalic 7769 White Stain": 1974.90,
  "Glass Scrap": 7.75,
  "Paper Cuttings": 34.30,
  "Paste Gum for Pasting": 1.13,
  "Maruti Green RSB3CC Stain": 1372.41,
  "Liquid Gum For Pasting": 1.13,
  "Plastic Bags": 0.85,
  "Fanta Stain": 1958.00,
  "Zinc Oxide": 105.87,
  "Copper Oxy Chloride": 605.00,
  "Calcined Alumina": 45.77,
  "Glass Powder": 28.11,
  "Pink Rose Stain": 171.63,
  "T Blue FCS Stain": 100.00,
  "Kraft Paper Roll": 27.97,
  "Black Stain": 2052.50,
  "Mettalic 7741 Copper Stain": 1390.03,
  "Majenta Pink Burgandi Stain": 1984.39,
  "Stretch Wrapping Roll": 2.85,
  "Mettalic 7763 Yellow Stain": 1860.00,
  "Quartz Powder for Polishing": 3.25,  // 3250 / 1000
  "Lemmon Yellow Stain": 1050.00,
  "Yellow Oxide Stain": 94.74,
  "Red Oxide Stain": 109.59,
  "Red Brown BS4 Stain": 438.29,
  "Polyster Net": 2.85,
  "Gauvar Gum": 28.11,
  "Havana Yellow FCS Stain": 430.05,
  "Coral Pink FCS Stain": 1786.93,
  "Red Stain": 2394.93,
  "Manganese Di Oxide": 10.22,
  "Corrugated Boxes": 526.42,
  "Quartz Powder for Matte": 3.25,      // 3250 / 1000
  "Chrome Oxide": 359.61,
  "Corrugated Liners": 29.18,
  "Barium Carbonate": 30.73,
  "Ceramic Rollers": 575.00,
  "Ceramic Pebbles": 82.16,
  "Orange / Golden Yellow Stain": 430.05,
  "Ball Clay Powder": 5.70,
  "PVA": 202.00,
  "Geru": 1557.78,
  "Zirconium": 235.00
};

async function updateRates() {
  try {
    console.log("=== Updating Raw Material Rates in Firestore using Node.js ===");

    const rmSnap = await db.collection('production_raw_materials').get();
    console.log(`Found ${rmSnap.size} raw materials in database.`);

    let updatedCount = 0;
    const matchedNames = [];

    for (const doc of rmSnap.docs) {
      const data = doc.data();
      const name = (data.name || '').trim();

      if (ratesMap[name] !== undefined) {
        const rate = ratesMap[name];
        await db.collection('production_raw_materials').doc(doc.id).update({
          currentRate: parseFloat(rate)
        });
        console.log(`Updated: '${name}' -> Rate: ${rate}`);
        updatedCount++;
        matchedNames.push(name);
      } else {
        console.log(`No rate update for: '${name}'`);
      }
    }

    console.log(`\n=== Update Completed Successfully! ===`);
    console.log(`Updated ${updatedCount} raw materials.`);

    // Print unmatched items
    const notMatched = Object.keys(ratesMap).filter(name => !matchedNames.includes(name));
    if (notMatched.length > 0) {
      console.log(`\nThese mapped items were not found in DB:`, notMatched);
    }
  } catch (error) {
    console.error("Error updating rates:", error);
  } finally {
    process.exit(0);
  }
}

updateRates();
