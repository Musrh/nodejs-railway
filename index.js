import express from "express";
import fetch from "node-fetch"; // si node >=18, fetch est natif
import cors from "cors";
import admin from "firebase-admin";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

// 🔹 Initialiser Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
});
const db = admin.firestore();

// 🔹 Endpoint pour récupérer et stocker les produits externes
app.get("/sync-external-products", async (req, res) => {
  try {
    const search = req.query.q || "smartphone";

    // 1️⃣ Récupérer depuis AliExpress via RapidAPI
    const response = await fetch(
      `https://aliexpress-datahub.p.rapidapi.com/item_search?q=${encodeURIComponent(search)}&page=1&limit=10`,
      {
        method: "GET",
        headers: {
          "x-rapidapi-host": "aliexpress-datahub.p.rapidapi.com",
          "x-rapidapi-key": RAPIDAPI_KEY,
        },
      }
    );

    const data = await response.json();
    const produits = data.items || [];

    // 2️⃣ Ajouter / mettre à jour dans Firestore
    const batch = db.batch();
    produits.forEach((p) => {
      const docRef = db.collection("ProductsExternes").doc(p.itemId.toString());
      batch.set(docRef, {
        title: p.title,
        price: p.price,
        imageUrl: p.imageUrl,
        url: p.url,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    await batch.commit();

    res.json({ success: true, count: produits.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Impossible de synchroniser les produits externes" });
  }
});

// 🔹 Endpoint pour le front : récupérer produits externes
app.get("/products-external", async (req, res) => {
  try {
    const snapshot = await db.collection("ProductsExternes").limit(20).get();
    const produits = [];
    snapshot.forEach((doc) => produits.push({ id: doc.id, ...doc.data() }));
    res.json(produits);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Impossible de récupérer les produits externes" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
