import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import serviceAccount from "./serviceAccountKey.json"; // ta clé Firebase

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint pour récupérer les produits externes
app.get("/products-external", async (req, res) => {
  try {
    const snapshot = await db.collection("ProductsExternes").get();
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Impossible de récupérer les produits externes" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
