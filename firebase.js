import admin from "firebase-admin";
import { env } from "./config/env.js";

if (!admin.apps.length) {
  // 🧠 Render converts newlines in env vars to literal "\n" — unescape them:
  const cleanPrivateKey = env.firebase.privateKey.replace(/\\n/g, "\n");

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.firebase.projectId,
        clientEmail: env.firebase.clientEmail,
        privateKey: cleanPrivateKey,
      }),
      storageBucket: "elvastore0.firebasestorage.app",
    });

    console.log("✅ Firebase Admin initialized successfully");
  } catch (err) {
    console.error("❌ Firebase Admin initialization failed:", err);
  }
}

const bucket = admin.storage().bucket();
export default bucket;
