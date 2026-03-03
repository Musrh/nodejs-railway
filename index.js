import express from "express";
import fetch from "node-fetch";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* ==============================
   🔥 INITIALISATION FIREBASE
============================== */

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("FIREBASE_SERVICE_ACCOUNT manquant !");
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/* ==============================
   🔥 FONCTION IMPORT ALIEXPRESS
============================== */

async function updateExternalProducts(keyword = "smartwatch") {
  try {
    if (!process.env.RAPIDAPI_KEY) {
      console.error("RAPIDAPI_KEY manquant !");
      return;
    }

    console.log("🔍 Recherche produits :", keyword);

    const response = await fetch(
      `https://aliexpress-datahub.p.rapidapi.com/item_search?keywords=${encodeURIComponent(
        keyword
      )}&page=1&limit=10`,
      {
        method: "GET",
        headers: {
          "x-rapidapi-host": "aliexpress-datahub.p.rapidapi.com",
          "x-rapidapi-key": process.env.RAPIDAPI_KEY
        }
      }
    );

    const data = await response.json();

    console.log("📦 Réponse RapidAPI reçue");

    // 🔥 Vérifier structure réelle
    const products =
      data.result ||
      data.data?.items ||
      data.result?.items ||
      data.items ||
      [];

    if (!Array.isArray(products) || products.length === 0) {
      console.log("❌ Aucun produit trouvé dans la réponse API");
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    const batch = db.batch();

    products.forEach((item) => {
      const id = item.itemId || item.id;
      if (!id) return;

      const docRef = db.collection("ProductsExternes").doc(id.toString());

      batch.set(
        docRef,
        {
          nom: item.title || item.name || "Produit sans nom",
          prix: parseFloat(item.price) || 0,
          image: item.imageUrl || item.image || "",
          source: "AliExpress",
          url: item.productUrl || item.url || "",
          featured: false,
          vendu: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    });

    await batch.commit();

    console.log(`✅ ${products.length} produits importés avec succès`);
  } catch (error) {
    console.error("🔥 Erreur updateExternalProducts:", error);
  }
}

/* ==============================
   🔥 ENDPOINT TEST MANUEL
============================== */

app.get("/update-products-external", async (req, res) => {
  const keyword = req.query.keyword || "smartwatch";

  await updateExternalProducts(keyword);

  res.json({
    status: "ok",
    message: `Import terminé pour "${keyword}"`
  });
});

/* ==============================
   🚀 START SERVER
============================== */

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
