import bucket from "../firebase.js";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const storage = multer.memoryStorage();
const upload = multer({ storage }).single("image");

export const uploadImage = (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file)
      return res.status(400).json({ success: false, message: "No file uploaded" });

    try {
      const file = req.file;
      const fileName = `uploads/${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
      const blob = bucket.file(fileName);

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

          // ✅ Works for all Firebase Storage buckets (new + old)
          const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;

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
  } catch (error) {
    console.error("❌ deleteByUrl error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
