import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

const serviceAccountPath = 'C:\\Users\\mokks\\Downloads\\shufactory-cmd-1-firebase-adminsdk-fbsvc-889e0978ae.json';
const cleanDataPath = 'C:\\Users\\mokks\\.gemini\\antigravity\\scratch\\clean_data.json';

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Service account file not found at: ${serviceAccountPath}`);
  process.exit(1);
}

if (!fs.existsSync(cleanDataPath)) {
  console.error(`Parsed data file not found at: ${cleanDataPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
const excelData = JSON.parse(fs.readFileSync(cleanDataPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Helper to generate next code
const generateNextCode = (prefix, currentCodes) => {
  let maxNum = 0;
  currentCodes.forEach(code => {
    if (code && code.startsWith(prefix)) {
      const numStr = code.substring(prefix.length);
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });
  const nextNum = maxNum + 1;
  const nextCode = `${prefix}${String(nextNum).padStart(3, '0')}`;
  currentCodes.add(nextCode); // Add to set so we don't reuse it in this run
  return nextCode;
};

async function importData() {
  try {
    console.log("=== Start Importing Master Data from Excel ===");

    // 1. Fetch current items to avoid duplication and get current highest codes
    console.log("Fetching existing items from Firestore...");
    
    // Fetch sizes
    const sizesSnap = await db.collection('production_sizes').get();
    const existingSizes = new Map();
    const sizeCodes = new Set();
    sizesSnap.forEach(doc => {
      const d = doc.data();
      if (d.name) existingSizes.set(d.name.trim().toLowerCase(), d);
      if (d.code) sizeCodes.add(d.code);
    });

    // Fetch units (measurements)
    const unitsSnap = await db.collection('production_measurements').get();
    const existingUnits = new Map();
    const unitCodes = new Set();
    unitsSnap.forEach(doc => {
      const d = doc.data();
      if (d.symbol) existingUnits.set(d.symbol.trim().toLowerCase(), d);
      if (d.code) unitCodes.add(d.code);
    });

    // Fetch raw materials
    const rmSnap = await db.collection('production_raw_materials').get();
    const existingRms = new Map();
    const rmCodes = new Set();
    rmSnap.forEach(doc => {
      const d = doc.data();
      if (d.name) existingRms.set(d.name.trim().toLowerCase(), d);
      if (d.code) rmCodes.add(d.code);
    });

    // 2. Import Sizes
    console.log(`\nProcessing ${excelData.sizes.length} sizes...`);
    let sizesAdded = 0;
    for (const s of excelData.sizes) {
      const name = s.size.trim();
      const key = name.toLowerCase();
      if (existingSizes.has(key)) {
        console.log(`- Size already exists: "${name}" (skipping)`);
      } else {
        const code = generateNextCode('siz', sizeCodes);
        await db.collection('production_sizes').add({
          name: name,
          code: code,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`+ Added Size: "${name}" -> ${code}`);
        sizesAdded++;
      }
    }

    // 3. Import Units
    // Skip row 0 (headers)
    const unitsToImport = excelData.units_raw.slice(1);
    console.log(`\nProcessing ${unitsToImport.length} units...`);
    let unitsAdded = 0;
    for (const u of unitsToImport) {
      if (u.length < 3) continue;
      const symbol = u[1].trim();
      const description = u[2].trim();
      const key = symbol.toLowerCase();
      if (existingUnits.has(key)) {
        console.log(`- Unit already exists: "${symbol}" (skipping)`);
      } else {
        const code = generateNextCode('uni', unitCodes);
        await db.collection('production_measurements').add({
          symbol: symbol,
          description: description,
          code: code,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`+ Added Unit: "${symbol}" (${description}) -> ${code}`);
        unitsAdded++;
      }
    }

    // 4. Import Raw Materials
    console.log(`\nProcessing ${excelData.raw_materials.length} raw materials...`);
    let rmsAdded = 0;
    for (const rm of excelData.raw_materials) {
      const name = rm.name.trim();
      const group = rm.group.trim();
      const key = name.toLowerCase();
      if (existingRms.has(key)) {
        console.log(`- Raw Material already exists: "${name}" (skipping)`);
      } else {
        const code = generateNextCode('raw', rmCodes);
        
        // Guess default unit
        let defaultUnit = 'Kgs';
        const groupLower = group.toLowerCase();
        const nameLower = name.toLowerCase();
        if (groupLower.includes('packing') || nameLower.includes('boxes') || nameLower.includes('bags') || nameLower.includes('seals')) {
          defaultUnit = 'Nos';
        }
        
        await db.collection('production_raw_materials').add({
          name: name,
          group: group,
          unit: defaultUnit,
          currentRate: 0.0,
          code: code,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`+ Added Raw Material: "${name}" (${group}) -> ${code} (Default Unit: ${defaultUnit})`);
        rmsAdded++;
      }
    }

    console.log(`\n=== Import Finished! ===`);
    console.log(`Sizes Added: ${sizesAdded}`);
    console.log(`Units Added: ${unitsAdded}`);
    console.log(`Raw Materials Added: ${rmsAdded}`);

  } catch (error) {
    console.error("Error during import:", error);
  } finally {
    process.exit(0);
  }
}

importData();
