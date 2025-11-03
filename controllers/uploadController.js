import { PassThrough } from "stream";
import bucket from "../firebase.js";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

/**
 * 🟢 POST /api/upload
 * Upload an image to Firebase Storage
 */
export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const ext = path.extname(req.file.originalname) || ".jpg";
    const fileName = `uploads/${Date.now()}-${uuidv4()}${ext}`;
    const file = bucket.file(fileName);

    const stream = new PassThrough();
    stream.end(req.file.buffer);

    await new Promise((resolve, reject) => {
      stream
        .pipe(
          file.createWriteStream({
            metadata: {
              contentType: req.file.mimetype,
              cacheControl: "public, max-age=31536000",
            },
            resumable: false,
          })
        )
        .on("error", reject)
        .on("finish", resolve);
    });

    // Make file public
    await file.makePublic();

    // 🧠 Detect if bucket is new (firebasestorage.app) or old (appspot.com)
    const isNewStorageDomain = bucket.name.includes(".firebasestorage.app");
    const baseUrl = isNewStorageDomain
      ? `https://${bucket.name}`
      : `https://firebasestorage.googleapis.com/v0/b/${bucket.name}`;

    const url = `${baseUrl}/o/${encodeURIComponent(fileName)}?alt=media`;

    res.json({ success: true, url });
  } catch (e) {
    console.error("❌ uploadImage error:", e);
    res.status(500).json({ success: false, message: e.message });
  }
};

/**
 * 🟠 DELETE /api/upload
 * Delete an image from Firebase Storage by its public URL
 */
export const deleteByUrl = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url)
      return res.status(400).json({ success: false, message: "Missing 'url'" });

    const decoded = decodeURIComponent(url);
    const match = decoded.match(/\/o\/(.+)\?alt=media/);
    if (match && match[1]) {
      const filePath = match[1];
      await bucket.file(filePath).delete({ ignoreNotFound: true });
      console.log(`🗑️ Deleted file: ${filePath}`);
    }

    res.json({ success: true });
  } catch (e) {
    console.error("❌ deleteByUrl error:", e);
    res.status(500).json({ success: false, message: e.message });
  }
};
