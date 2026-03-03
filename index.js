// index.js
import express from "express";
import fetch from "node-fetch"; // npm install node-fetch
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 🔹 Initialisation Firebase
admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  )
});
const db = admin.firestore();

// 🔹 Endpoint pour mettre à jour les produits externes
app.get("/update-products-external", async (req, res) => {
  const keyword = req.query.keyword;
  if (!keyword) return res.status(400).send("Paramètre keyword manquant");

  try {
    // 🔹 Récupérer les produits depuis AliExpress via RapidAPI
    const response = await fetch(
      `https://aliexpress-datahub.p.rapidapi.com/item_search?keywords=${encodeURIComponent(
        keyword
      )}&limit=10`,
      {
        headers: {
          "X-RapidAPI-Host": "aliexpress-datahub.p.rapidapi.com",
          "X-RapidAPI-Key": process.env.RAPIDAPI_KEY
        }
      }
    );

    if (!response.ok) throw new Error("Erreur API AliExpress");
    const data = await response.json();

    if (!data.result || !data.result.items) {
      return res.status(200).send("Aucun produit trouvé");
    }

    const batch = db.batch();
    const collectionRef = db.collection("ProductsExternes");

    data.result.items.forEach((item) => {
      const docRef = collectionRef.doc(item.itemId); // Id unique AliExpress
      batch.set(docRef, {
        nom: item.title,
        prix: parseFloat(item.salePrice) || 0,
        imageUrl: item.imageUrl || "",
        source: "AliExpress",
        url: item.productUrl || ""
      }, { merge: true }); // merge pour mettre à jour si déjà existant
    });

    await batch.commit();
    res.send(`Mise à jour terminée pour ${data.result.items.length} produits`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur serveur : " + err.message);
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
