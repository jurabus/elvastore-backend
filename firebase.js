// firebase.js
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

if (!admin.apps.length) {
  let serviceAccount;

  try {
    // Parse the service account JSON from environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is missing");
    }
  } catch (error) {
    console.error("❌ Failed to parse Firebase service account JSON:", error);
    process.exit(1); // Stop the app if credentials are invalid
  }

  // Initialize Firebase Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET, // e.g. starlyclub.appspot.com
  });
}

const bucket = admin.storage().bucket();

export default bucket;
