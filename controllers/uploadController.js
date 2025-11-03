// controllers/uploadController.js
import bucket from "../firebase.js";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const storage = multer.memoryStorage();
const upload = multer({ storage }).single("image");

// === Upload file to Firebase Storage (supports new .firebasestorage.app buckets) ===
export const uploadImage = (req, res) => {
  upload(req, res, async (err) => {
    if (err)
      return res.status(400).json({ success: false, message: err.message });
    if (!req.file)
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });

    try {
      const file = req.file;
      const ext = path.extname(file.originalname) || ".jpg";
      const fileName = `uploads/${uuidv4()}-${Date.now()}${ext}`;
      const blob = bucket.file(fileName);

      // ✅ Infer proper MIME type fallback if missing
      let contentType = file.mimetype;
      if (!contentType || contentType === "application/octet-stream") {
        if (ext.match(/\.png$/i)) contentType = "image/png";
        else if (ext.match(/\.jpe?g$/i)) contentType = "image/jpeg";
        else if (ext.match(/\.gif$/i)) contentType = "image/gif";
        else contentType = "application/octet-stream";
      }

      // ✅ Stream upload to Firebase Storage
      const blobStream = blob.createWriteStream({
        metadata: { contentType, cacheControl: "public, max-age=31536000" },
      });

      blobStream.on("error", (error) => {
        console.error("❌ Upload error:", error);
        res
          .status(500)
          .json({ success: false, message: "Upload failed: " + error.message });
      });

      blobStream.on("finish", async () => {
        try {
          // Make file public
          await blob.makePublic();

          // ✅ Correct public URL for new-style buckets
          const encodedPath = encodeURIComponent(fileName);
          const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media`;

          console.log("✅ Uploaded:", fileName);
          console.log("🌐 URL:", publicUrl);

          res.status(200).json({ success: true, url: publicUrl });
        } catch (error) {
          console.error("⚠️ makePublic error:", error);
          res
            .status(500)
            .json({ success: false, message: "makePublic failed: " + error.message });
        }
      });

      blobStream.end(file.buffer);
    } catch (error) {
      console.error("🔥 Upload failed:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
};

// === Delete image by its public URL ===
export const deleteByUrl = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url)
      return res
        .status(400)
        .json({ success: false, message: "Missing 'url'" });

    const decoded = decodeURIComponent(url);
    const match = decoded.match(/\/o\/(.+)\?alt=media/);
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
