import express from "express";
import fetch from "node-fetch"; // npm install node-fetch@2
import admin from "firebase-admin";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 🔹 Initialiser Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🔹 Fonction pour mettre à jour les produits externes
async function updateExternalProducts(keyword = "smartwatch") {
  try {
    const res = await fetch(
      `https://aliexpress-datahub.p.rapidapi.com/item_search?keywords=${encodeURIComponent(keyword)}&page=1&limit=10`,
      {
        method: "GET",
        headers: {
          "x-rapidapi-host": "aliexpress-datahub.p.rapidapi.com",
          "x-rapidapi-key": process.env.RAPIDAPI_KEY
        }
      }
    );

    const data = await res.json();

    if (!data.result || !Array.isArray(data.result)) {
      console.log("Aucun produit reçu depuis AliExpress");
      return;
    }

    const batch = db.batch();

    data.result.forEach((item) => {
      const docRef = db.collection("ProductsExternes").doc(item.itemId); // id unique AliExpress

      batch.set(docRef, {
        nom: item.title,
        prix: parseFloat(item.price) || 0,
        image: item.imageUrl || item.image,
        source: "AliExpress",
        url: item.productUrl || item.url
      }, { merge: true }); // merge true pour ne pas écraser par erreur
    });

    await batch.commit();
    console.log(`${data.result.length} produits externes mis à jour`);
  } catch (err) {
    console.error("Erreur updateExternalProducts:", err);
  }
}

// 🔹 Endpoint pour lancer manuellement
app.get("/update-products-external", async (req, res) => {
  const keyword = req.query.keyword || "smartwatch";
  await updateExternalProducts(keyword);
  res.send({ status: "ok", message: `Produits externes mis à jour pour "${keyword}"` });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
