import bucket from "../firebase.js";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const storage = multer.memoryStorage();
const upload = multer({ storage }).single("image");

/**
 * 🟢 POST /api/upload
 * Upload an image to Firebase Storage and return a signed URL (Flutter Web safe)
 */
export const uploadImage = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    try {
      const file = req.file;
      const ext = path.extname(file.originalname) || ".jpg";
      const fileName = `uploads/${uuidv4()}-${Date.now()}${ext}`;
      const blob = bucket.file(fileName);

      // ✅ Ensure correct MIME type
      let contentType = file.mimetype;
      if (!contentType || contentType === "application/octet-stream") {
        if (ext.match(/\.png$/i)) contentType = "image/png";
        else if (ext.match(/\.jpe?g$/i)) contentType = "image/jpeg";
        else if (ext.match(/\.gif$/i)) contentType = "image/gif";
        else contentType = "application/octet-stream";
      }

      // ✅ Upload buffer to Firebase Storage
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
          // ✅ Generate long-lived signed URL (no makePublic(), CORS-safe)
          const [signedUrl] = await blob.getSignedUrl({
            action: "read",
            expires: "03-01-2035", // valid until 2035
          });

          console.log("✅ Uploaded:", fileName);
          console.log("🌐 Signed URL:", signedUrl);

          res.status(200).json({ success: true, url: signedUrl });
        } catch (error) {
          console.error("⚠️ Signed URL generation failed:", error);
          res.status(500).json({
            success: false,
            message: "Signed URL generation failed: " + error.message,
          });
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
 * 🟠 DELETE /api/upload
 * Delete an image from Firebase Storage using its signed URL
 */
export const deleteByUrl = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url)
      return res
        .status(400)
        .json({ success: false, message: "Missing 'url'" });

    const decoded = decodeURIComponent(url);
    const match = decoded.match(/\/o\/(.+)\?/);
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
