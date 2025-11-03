// controllers/uploadController.js
import bucket from "../firebase.js";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const storage = multer.memoryStorage();
const upload = multer({ storage }).single("image");

/**
 * POST /api/upload
 * Upload file to Firebase Storage (correct for new firebasestorage.app)
 */
export const uploadImage = (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file)
      return res.status(400).json({ success: false, message: "No file uploaded" });

    try {
      const file = req.file;
      const fileName = `uploads/${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
      const blob = bucket.file(fileName);

      // ✅ Stream upload to Firebase Storage
      const blobStream = blob.createWriteStream({
        metadata: { contentType: file.mimetype },
      });

      blobStream.on("error", (error) => {
        console.error("❌ Upload error:", error);
        res.status(500).json({ success: false, message: error.message });
      });

      blobStream.on("finish", async () => {
        try {
          await blob.makePublic();

          // ✅ Use Google Cloud Storage direct link (works for new system)
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

          console.log("✅ Uploaded:", fileName);
          console.log("🌐 Public URL:", publicUrl);

          res.status(200).json({ success: true, url: publicUrl });
        } catch (err) {
          console.error("⚠️ Failed to make public:", err);
          res.status(500).json({ success: false, message: err.message });
        }
      });

      blobStream.end(file.buffer);
    } catch (error) {
      console.error("🔥 Upload failed:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
};

/**
 * DELETE /api/upload
 * Delete image by public URL
 */
export const deleteByUrl = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url)
      return res.status(400).json({ success: false, message: "Missing 'url'" });

    const decoded = decodeURIComponent(url);
    const match = decoded.match(/https:\/\/storage\.googleapis\.com\/[^/]+\/(.+)/);
    if (match && match[1]) {
      const filePath = match[1];
      await bucket.file(filePath).delete({ ignoreNotFound: true });
      console.log(`🗑️ Deleted file: ${filePath}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("❌ deleteByUrl error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
