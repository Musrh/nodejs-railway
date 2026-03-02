import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Initialisation Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_KEY)),
});

const db = admin.firestore();

// 🔹 Route pour importer produits AliExpress
app.get("/import-products", async (req, res) => {
  try {
    const response = await fetch(
      "https://aliexpress-datahub.p.rapidapi.com/item_search",
      {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
          "X-RapidAPI-Host": "aliexpress-datahub.p.rapidapi.com",
        },
      }
    );

    const data = await response.json();

    // ⚠️ Adapter selon structure réelle API
    const produits = data.result?.resultList || [];

    let count = 0;

    for (const p of produits) {
      const productId = p.item?.itemId;
      if (!productId) continue;

      await db.collection("ProductsExternes")
        .doc(productId.toString())
        .set({
          nom: p.item.title,
          prix: parseFloat(p.item.price?.salePrice) || 0,
          image: p.item.image,
          promo: false,
          source: "aliexpress",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      count++;
    }

    res.send(`✅ ${count} produits importés dans ProductsExternes`);
  } catch (error) {
    console.error(error);
    res.status(500).send("❌ Erreur import produits");
  }
});

// 🔹 Route test
app.get("/", (req, res) => {
  res.send("🚀 API AliExpress Railway OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
