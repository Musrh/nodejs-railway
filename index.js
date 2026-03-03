import express from "express";
import fetch from "node-fetch"; // npm install node-fetch@2
import admin from "firebase-admin";

import serviceAccount from "./serviceAccountKey.json"; // ton JSON Firebase

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const app = express();

// 🔹 Endpoint pour récupérer produits AliExpress et ajouter dans Firestore
app.get("/update-products-external", async (req, res) => {
  try {
    // Exemple : recherche "smartwatch"
    const keyword = req.query.keyword || "smartwatch";

    const response = await fetch(
      `https://aliexpress-datahub.p.rapidapi.com/item_search?keyword=${encodeURIComponent(
        keyword
      )}&limit=5`, // nombre de produits à récupérer
      {
        method: "GET",
        headers: {
          "x-rapidapi-host": "aliexpress-datahub.p.rapidapi.com",
          "x-rapidapi-key": process.env.RAPIDAPI_KEY,
        },
      }
    );

    const data = await response.json();

    if (!data.result) return res.status(500).json({ message: "Pas de résultats" });

    const batch = db.batch();

    data.result.forEach((item) => {
      const docRef = db.collection("ProductsExternes").doc(item.itemId);
      batch.set(docRef, {
        nom: item.title,
        prix: Number(item.price.value) || 0,
        imageUrl: item.image,
        source: "AliExpress",
        url: item.productDetailUrl,
      });
    });

    await batch.commit();

    res.json({ message: "Produits externes mis à jour", count: data.result.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
