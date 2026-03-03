import express from "express";
import fetch from "node-fetch";
import admin from "firebase-admin";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Firebase init sécurisé
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (e) {
  console.error("Erreur parsing FIREBASE_SERVICE_ACCOUNT");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateExternalProducts(keyword = "smartwatch") {
  try {
    const res = await fetch(
      `https://aliexpress-datahub.p.rapidapi.com/item_search?keywords=${encodeURIComponent(keyword)}&page=1&limit=10`,
      {
        headers: {
          "x-rapidapi-host": "aliexpress-datahub.p.rapidapi.com",
          "x-rapidapi-key": process.env.RAPIDAPI_KEY
        }
      }
    );

    console.log("RapidAPI status:", res.status);

    const data = await res.json();
    console.log("RapidAPI response preview:", JSON.stringify(data).slice(0, 300));

    const items =
      data?.result ||
      data?.data?.items ||
      data?.items ||
      [];

    if (!Array.isArray(items) || items.length === 0) {
      console.log("Aucun produit trouvé.");
      return;
    }

    const batch = db.batch();

    items.forEach((item) => {
      const id = item.itemId || item.id;
      if (!id) return;

      const docRef = db.collection("ProductsExternes").doc(String(id));

      batch.set(
        docRef,
        {
          nom: item.title || item.name || "Sans nom",
          prix: parseFloat(item.price) || 0,
          image: item.imageUrl || item.image || "",
          source: "AliExpress",
          url: item.productUrl || item.url || ""
        },
        { merge: true }
      );
    });

    await batch.commit();
    console.log("Produits mis à jour:", items.length);

  } catch (err) {
    console.error("Erreur updateExternalProducts:", err);
  }
}

app.get("/update-products-external", async (req, res) => {
  const keyword = req.query.keyword || "smartwatch";
  await updateExternalProducts(keyword);
  res.json({ success: true, keyword });
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
