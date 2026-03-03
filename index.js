import express from "express";
import fetch from "node-fetch";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

// 🔹 Initialisation Firebase
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

const app = express();
const PORT = process.env.PORT || 3000;

// 🔹 Fonction pour mettre à jour les produits externes
const updateProductsExternal = async (keyword = "smartwatch") => {
  try {
    // Appel API RapidAPI AliExpress (item_search)
    const response = await fetch(
      `https://aliexpress-datahub.p.rapidapi.com/item_search?keyword=${encodeURIComponent(
        keyword
      )}&page=1&limit=10`,
      {
        method: "GET",
        headers: {
          "X-RapidAPI-Host": "aliexpress-datahub.p.rapidapi.com",
          "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        },
      }
    );

    const data = await response.json();
    if (!data.result || !Array.isArray(data.result)) {
      throw new Error("Aucun résultat API ou format inattendu");
    }

    const batch = db.batch();
    const collectionRef = db.collection("ProductsExternes");

    data.result.forEach((item) => {
      // 🔹 Préparer les données à stocker
      const docRef = collectionRef.doc(item.itemId.toString());
      batch.set(docRef, {
        nom: item.title || "Produit externe",
        prix: item.price || 0,
        images: item.image || "", // Assure-toi que c'est bien une URL image
        source: "AliExpress",
        url: item.productUrl || "",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    return `✅ ${data.result.length} produits externes mis à jour.`;
  } catch (err) {
    console.error("Erreur updateProductsExternal:", err);
    throw err;
  }
};

// 🔹 Endpoint pour mise à jour manuelle
app.get("/update-products-external", async (req, res) => {
  const keyword = req.query.keyword || "smartwatch";
  try {
    const message = await updateProductsExternal(keyword);
    res.send(message);
  } catch (err) {
    res.status(500).send("Erreur mise à jour produits externes");
  }
});

// 🔹 Test endpoint simple
app.get("/", (req, res) => res.send("Server Node.js MiniShop ok"));

// 🔹 Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
