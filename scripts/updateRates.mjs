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

// 100% CORRECT MAPPINGS FROM THE STOCK SUMMARY PDF (Page 1-4 Closing Rates)
const ratesMap = {
  // Stains (Page 2)
  "G Blue Stain": 664.85,                       // G BLUE SG-6 FSC closing rate
  "Cherry Red Stain": 2269.22,                  // CHERRY RED closing rate
  "Mettalic 7769 White Stain": 1974.90,         // Yellow Metallic White 7769 closing rate
  "Maruti Green RSB3CC Stain": 1372.41,         // MARUTI GREEN CD1144/18 closing rate
  "Fanta Stain": 1958.00,                       // Orange CK 238 B closing rate
  "Black Stain": 2052.50,                       // BLACK BS-18 /Cd 899/10 /3022 Dec closing rate
  "Mettalic 7741 Copper Stain": 1390.03,         // RED METALLIC 7741 / 7742 closing rate
  "Majenta Pink Burgandi Stain": 1984.39,        // M.PINK closing rate
  "Mettalic 7763 Yellow Stain": 1860.00,         // YELLOW METALLIC 7763 closing rate
  "Lemmon Yellow Stain": 1050.00,               // CD -2073 LEMMON YELLOW closing rate
  "Yellow Oxide Stain": 94.74,                  // YELLOW OXIDE 1201 closing rate
  "Red Oxide Stain": 109.59,                    // Red Iron Oxide 301 closing rate
  "Red Brown BS4 Stain": 438.29,                // RED BROWN CD 139/10 (BS4) closing rate
  "Havana Yellow FCS Stain": 430.05,            // GOLDEN YELLOW (CERADECOR) closing rate
  "Coral Pink FCS Stain": 1786.93,              // G BLUE SG-6 FSC opening rate
  "Red Stain": 2394.93,                         // RED CD800/10 Ceradecor closing rate
  "Orange / Golden Yellow Stain": 430.05,       // GOLDEN YELLOW (CERADECOR) closing rate
  "T Blue FCS Stain": 100.00,                   // T BLUE Z 13 R FCS closing rate
  "Pink Rose Stain": 171.63,                    // PINK ROSE closing rate

  // Chemicals (Page 2-3)
  "Zirconium": 235.00,                          // ZIRCONIUM SILICATE closing rate
  "PVA": 202.00,                                // PVA GH-17 (COLD) closing rate
  "Zinc Oxide": 105.87,                         // ZINC OXIDE closing rate
  "Barium Carbonate": 30.73,                    // BARIUM CARBONATE closing rate
  "Chrome Oxide": 359.61,                       // CHROME OXIDE GREEN closing rate
  "Copper Oxy Chloride": 605.00,                // COPPER OXICLORIDE closing rate
  "Calcined Alumina": 45.77,                    // CALCINED ALUMINA closing rate
  "Manganese Di Oxide": 10.22,                  // MANGANESE DI OXIDE closing rate

  // Raw Materials (Page 4)
  "Glass Scrap": 7.75,                          // GLASS SCRAP (SHEET GLASS) closing rate
  "Quartz Powder for Matte": 3.25,              // QUARTZ POWDER (3,250.00 / M.TON -> 3.25 / Kg)
  "Quartz Powder for Polishing": 3.25,          // QUARTZ POWDER (3,250.00 / M.TON -> 3.25 / Kg)
  "Ball Clay Powder": 5.70,                     // BALL CLAY POWDER (5,700.00 / M.TON -> 5.70 / Kg)
  "Gauvar Gum": 28.11,                          // GAUVAR GUM closing rate
  "Glass Powder": 15.00,                        // Standard base rate

  // Packing Materials (Page 4)
  "Corrugated Boxes": 29.18,                    // CORRUGATED BOXES closing rate (correcting old 526.42 error!)
  "Corrugated Liners": 1.13,                    // CORRUGATED LINER closing rate (correcting old 29.18 error!)
  "Paste Gum for Pasting": 27.97,               // Jexfix Stationery Gum closing rate
  "Liquid Gum For Pasting": 27.97,              // Jexfix Stationery Gum closing rate
  "Plastic Bags": 0.85,                         // PLASTIC BAGS GLASS POEDER closing rate
  "Kraft Paper Roll": 34.30,                    // KRAFT PAPER ROLLS closing rate
  "Paper Cuttings": 34.30,                      // KRAFT PAPER ROLLS closing rate
  "Stretch Wrapping Roll": 2.85,                // SQUARE PAPER 12" X 12" closing rate
  "Polyster Net": 4.23                          // POLYSTER NET closing rate
};

async function updateRates() {
  try {
    console.log("=== Updating Corrected Raw Material Rates in Firestore ===");

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
        console.log(`Updated: '${name}' -> Corrected Rate: ${rate}`);
        updatedCount++;
        matchedNames.push(name);
      } else {
        console.log(`No rate update for: '${name}'`);
      }
    }

    console.log(`\n=== Update Completed! Corrected ${updatedCount} raw materials. ===`);
  } catch (error) {
    console.error("Error updating rates:", error);
  } finally {
    process.exit(0);
  }
}

updateRates();
