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

async function fixRecipeAndLog() {
  try {
    console.log("=== Fixing Pebble White Recipe & Recalculating Log ===");

    const glassPowderId = 'GVwNHuTfhnDjF6fpVGQg';
    const zirconiumId = 'zoZA6xKcuftsuzUkIt1z';
    const blueStainId = '0OxOnjIjAAiYEvEnxgxB';

    const fullPebbleWhiteRecipe = [
      {
        rawMaterialId: glassPowderId,
        name: "Glass Powder",
        percentage: 100
      },
      {
        rawMaterialId: zirconiumId,
        name: "Zirconium",
        percentage: 0.5
      },
      {
        rawMaterialId: blueStainId,
        name: "G Blue Stain",
        percentage: 0.00015
      }
    ];

    // 1. Update Pebble White recipe in production_colours
    const pebbleWhiteColId = 'TxG9Jj1wVIHuIzAqvwpY';
    await db.collection('production_colours').doc(pebbleWhiteColId).update({
      recipe: fullPebbleWhiteRecipe
    });
    console.log("[SUCCESS] Updated Pebble White master recipe with Glass Powder (100%).");

    // 2. Fetch the daily production document
    const docId = 'xhjubulbe7kpCZUedaU5';
    const docRef = db.collection('dailyProductions').doc(docId);
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {
      const data = docSnap.data();
      const coloursFired = data.coloursFired || [];
      
      // Update recipeSnapshot inside coloursFired for Pebble White
      const updatedColoursFired = coloursFired.map(cf => {
        if (cf.colourId === pebbleWhiteColId) {
          return {
            ...cf,
            recipeSnapshot: fullPebbleWhiteRecipe
          };
        }
        return cf;
      });

      // Recalculate aggregated raw materials
      const consumptionMap = {};
      updatedColoursFired.forEach(cf => {
        if (!cf.colourId || !cf.totalWeight) return;
        const recipe = cf.recipeSnapshot || [];
        const weight = parseFloat(cf.totalWeight) || 0;
        
        recipe.forEach(ing => {
          const amount = (weight * ing.percentage) / 100;
          if (!consumptionMap[ing.rawMaterialId]) {
            consumptionMap[ing.rawMaterialId] = {
              rawMaterialId: ing.rawMaterialId,
              name: ing.name || 'Unknown Material',
              total: 0
            };
          }
          consumptionMap[ing.rawMaterialId].total += amount;
        });
      });

      const correctedList = Object.values(consumptionMap).filter(rm => rm.total > 0);

      // Update doc in Firestore
      await docRef.update({
        coloursFired: updatedColoursFired,
        calculatedRawMaterials: correctedList
      });

      console.log("[SUCCESS] Updated coloursFired snapshots and recalculated raw materials in document xhjubulbe7kpCZUedaU5.");
      console.log("New Calculated Raw Materials:");
      correctedList.forEach(rm => {
        console.log(`- ${rm.name}: ${rm.total.toFixed(3)}kg`);
      });
    } else {
      console.log(`Daily production log ${docId} not found.`);
    }

  } catch (error) {
    console.error("Error fixing Pebble White:", error);
  } finally {
    process.exit(0);
  }
}

fixRecipeAndLog();
