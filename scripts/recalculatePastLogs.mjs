import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccountPath = 'C:\\Users\\mokks\\Downloads\\shufactory-cmd-1-firebase-adminsdk-fbsvc-889e0978ae.json';

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Service account file not found at: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixPastLogs() {
  try {
    console.log("=== Recalculating Past Production Logs ===");
    
    // Fetch all colours recipes to use as fallback
    const coloursSnap = await db.collection('production_colours').get();
    const coloursMap = new Map();
    coloursSnap.forEach(doc => {
      coloursMap.set(doc.id, doc.data());
    });
    
    // Fetch all raw materials for fallback names
    const rmSnap = await db.collection('production_raw_materials').get();
    const rmMap = new Map();
    rmSnap.forEach(doc => {
      rmMap.set(doc.id, doc.data());
    });

    // Fetch all daily productions
    const productionsSnap = await db.collection('dailyProductions').get();
    console.log(`Found ${productionsSnap.size} daily production logs.`);
    
    let updatedCount = 0;
    
    for (const doc of productionsSnap.docs) {
      const data = doc.data();
      const coloursFired = data.coloursFired || [];
      
      if (coloursFired.length === 0) {
        console.log(`Log ${doc.id} on ${data.date}: No colours fired (skipping).`);
        continue;
      }
      
      console.log(`\nProcessing log ${doc.id} (${data.date}):`);
      coloursFired.forEach((cf, idx) => {
        console.log(`  - Fired: ${cf.colourName || 'Unknown'} (${cf.totalWeight}kg)`);
      });

      // Calculate consumption for ALL colours fired
      const consumptionMap = {};
      
      coloursFired.forEach(cf => {
        if (!cf.colourId || !cf.totalWeight) return;
        
        // Find recipe either from snapshot or from live colours master
        let recipe = cf.recipeSnapshot || [];
        if (recipe.length === 0) {
          const liveCol = coloursMap.get(cf.colourId);
          recipe = liveCol?.recipe || [];
        }
        
        if (recipe.length === 0) {
          console.log(`    Warning: No recipe found for Colour ${cf.colourId} (${cf.colourName})`);
          return;
        }
        
        const weight = parseFloat(cf.totalWeight) || 0;
        recipe.forEach(ing => {
          const amount = (weight * ing.percentage) / 100;
          if (!consumptionMap[ing.rawMaterialId]) {
            // Find name
            let name = ing.name;
            if (!name) {
              const liveRm = rmMap.get(ing.rawMaterialId);
              name = liveRm?.name || 'Unknown Material';
            }
            consumptionMap[ing.rawMaterialId] = {
              rawMaterialId: ing.rawMaterialId,
              name: name,
              total: 0
            };
          }
          consumptionMap[ing.rawMaterialId].total += amount;
        });
      });
      
      const correctedList = Object.values(consumptionMap).filter(rm => rm.total > 0);
      
      if (correctedList.length === 0) {
        console.log(`  -> Calculated consumption is empty (skipping).`);
        continue;
      }

      console.log(`  -> Corrected Raw Materials (Total: ${correctedList.length} items):`);
      correctedList.forEach(rm => {
        console.log(`     * ${rm.name}: ${rm.total.toFixed(3)}kg`);
      });

      // Update in Firestore
      await db.collection('dailyProductions').doc(doc.id).update({
        calculatedRawMaterials: correctedList
      });
      console.log(`  [SUCCESS] Updated log ${doc.id} in Firestore.`);
      updatedCount++;
    }
    
    console.log(`\n=== Migration Finished! ===`);
    console.log(`Recalculated & Updated: ${updatedCount} logs.`);
    
  } catch (error) {
    console.error("Error during migration:", error);
  } finally {
    process.exit(0);
  }
}

fixPastLogs();
