// index.js
import express from "express";
import fetch from "node-fetch"; // npm install node-fetch
import admin from "firebase-admin";

// 🔹 Initialisation Express
const app = express();
app.use(express.json());

// 🔹 Initialisation Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 🔹 Route de test
app.get("/", (req, res) => {
  res.send("🚀 API MiniShop OK");
});

// 🔹 Route pour importer des produits externes via AliExpress
app.get("/import-products", async (req, res) => {
  try {
    const query = req.query.q; // ex: ?q=montre
    if (!query) return res.status(400).send("❌ Query manquante");

    const response = await fetch(
      `https://aliexpress-datahub.p.rapidapi.com/item_search?query=${encodeURIComponent(query)}&page=1&limit=10`,
      {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
          "X-RapidAPI-Host": "aliexpress-datahub.p.rapidapi.com",
        },
      }
    );

    const data = await response.json();
    if (!data.result || !data.result.length) return res.status(404).send("❌ Aucun produit trouvé");

    // 🔹 Ajout dans Firestore (batch pour plusieurs produits)
    const batch = db.batch();
    data.result.forEach((item) => {
      const docRef = db.collection("ProductsExternes").doc(item.itemId);
      batch.set(docRef, {
        itemId: item.itemId,
        title: item.title,
        price: item.price,
        images: item.images,
        url: item.url,
      });
    });
    await batch.commit();

    res.json({ message: `✅ ${data.result.length} produits importés dans Firestore` });
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Erreur lors de l'importation des produits");
  }
});

// 🔹 Lancer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 MiniShop API en ligne sur le port ${PORT}`));
