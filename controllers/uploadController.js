// controllers/uploadController.js
import bucket from "../firebase.js";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const storage = multer.memoryStorage();
const upload = multer({ storage }).single("image");

// === Upload file to Firebase Storage ===
export const uploadImage = (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    try {
      const file = req.file;
      const fileName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
      const blob = bucket.file(fileName);
      const blobStream = blob.createWriteStream({
        metadata: { contentType: file.mimetype },
      });

      blobStream.on("error", (error) => {
        console.error("❌ Upload error:", error);
        res.status(500).json({ success: false, message: error.message });
      });

      blobStream.on("finish", async () => {
        // ✅ Make file public
        await blob.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        res.status(200).json({ success: true, url: publicUrl });
      });

      blobStream.end(file.buffer);
    } catch (error) {
      console.error("🔥 Upload failed:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
};
