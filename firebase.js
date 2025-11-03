import admin from "firebase-admin";
import { env } from "./config/env.js";

// 🧠 Clean up the private key for Render (convert \n to real newlines)
const cleanPrivateKey = env.firebase.privateKey.replace(/\\n/g, "\n");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey: cleanPrivateKey,
    }),
    storageBucket: env.firebase.storageBucket,
  });
}

const bucket = admin.storage().bucket();
export default bucket;
