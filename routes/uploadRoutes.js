// routes/uploadRoutes.js
import express from "express";
import multer from "multer";
import bucket from "../firebase.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 🔥 Utility: delete a Firebase file by its URL
async function deleteFileByUrl(fileUrl) {
  try {
    if (!fileUrl) return;

    const decoded = decodeURIComponent(fileUrl);
    const match = decoded.match(/\/o\/(.+)\?alt=media/);
    if (match && match[1]) {
      const filePath = match[1];
      const file = bucket.file(filePath);
      await file.delete({ ignoreNotFound: true });
      console.log(`🗑️ Deleted file: ${filePath}`);
    } else {
      console.warn("⚠️ Could not extract file path:", fileUrl);
    }
  } catch (err) {
    console.warn("⚠️ Failed to delete file:", err.message);
  }
}

// 📸 POST /api/upload — Upload new image to Firebase
router.post("/", upload.single("image"), async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image uploaded" });
    }

    const oldUrl = req.body.oldUrl || null;
    const fileName = `uploads/${Date.now()}-${uuidv4()}-${req.file.originalname}`;
    const file = bucket.file(fileName);

    await file.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype,
        cacheControl: "public, max-age=31536000", // 1-year CDN cache
      },
    });

    // 🔓 Make file public
    await file.makePublic();

    // ✅ Permanent public URL (non-expiring)
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
      fileName
    )}?alt=media`;

    console.log("✅ Uploaded:", fileName);
    console.log("🌐 Public URL:", publicUrl);

    if (oldUrl) await deleteFileByUrl(oldUrl);

    res.status(200).json({ success: true, url: publicUrl });
  } catch (error) {
    console.error("❌ Upload error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 🗑️ DELETE /api/upload — Delete unused/cancelled image
router.delete("/", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const { url } = req.body;
    if (!url) {
      return res
        .status(400)
        .json({ success: false, message: "Missing 'url' in request body" });
    }

    await deleteFileByUrl(url);
    res.json({ success: true, message: "File deleted successfully" });
  } catch (error) {
    console.error("❌ Delete error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
