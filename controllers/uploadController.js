import bucket from "../firebase.js";
import Busboy from "busboy";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const setCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
};
export const corsPreflight = (req, res) => { setCors(res); res.sendStatus(200); };

// ---------- SINGLE STREAM (legacy compatible) ----------
export const uploadImageStream = (req, res) => {
  setCors(res);
  const busboy = Busboy({ headers: req.headers });
  let filePromise;

  busboy.on("file", (_, file, info) => {
    const ext = path.extname(info.filename || ".jpg") || ".jpg";
    const fileName = `uploads/${uuidv4()}-${Date.now()}${ext}`;
    const blob = bucket.file(fileName);
    filePromise = new Promise((resolve, reject) => {
      file.pipe(
        blob.createWriteStream({
          metadata: { contentType: info.mimeType || "image/jpeg", cacheControl: "public,max-age=31536000" },
          resumable: false,
        })
      )
      .on("error", reject)
      .on("finish", async () => {
        const [url] = await blob.getSignedUrl({ action: "read", expires: "03-01-2035" });
        resolve(url);
      });
    });
  });

  busboy.on("finish", async () => {
    try {
      const url = await filePromise;
      res.json({ success: true, urls: [url] });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });
  req.pipe(busboy);
};

// ---------- MULTI STREAM ----------
export const uploadMultipleStream = (req, res) => {
  setCors(res);
  const busboy = Busboy({ headers: req.headers });
  const promises = [];

  busboy.on("file", (_, file, info) => {
    const ext = path.extname(info.filename || ".jpg") || ".jpg";
    const fileName = `uploads/${uuidv4()}-${Date.now()}${ext}`;
    const blob = bucket.file(fileName);
    const p = new Promise((resolve, reject) => {
      file.pipe(
        blob.createWriteStream({
          metadata: { contentType: info.mimeType || "image/jpeg", cacheControl: "public,max-age=31536000" },
          resumable: false,
        })
      )
      .on("error", reject)
      .on("finish", async () => {
        const [url] = await blob.getSignedUrl({ action: "read", expires: "03-01-2035" });
        resolve(url);
      });
    });
    promises.push(p);
  });

  busboy.on("finish", async () => {
    try {
      const urls = await Promise.all(promises);
      res.json({ success: true, urls });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });
  req.pipe(busboy);
};

// ---------- DIRECT UPLOAD (prepare + complete) ----------
export const getUploadUrl = async (req, res) => {
  setCors(res);
  try {
    const { contentType = "image/jpeg", ext = ".jpg" } = req.body || {};
    const fileName = `uploads/${uuidv4()}-${Date.now()}${ext}`;
    const [uploadUrl] = await bucket.file(fileName).getSignedUrl({
      action: "write",
      expires: Date.now() + 10 * 60 * 1000,
      contentType,
    });
    res.json({ success: true, uploadUrl, fileName, contentType });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const getReadUrl = async (req, res) => {
  setCors(res);
  try {
    const { fileName } = req.body;
    if (!fileName) return res.status(400).json({ success: false, message: "fileName required" });
    const file = bucket.file(fileName);
    const [exists] = await file.exists();
    if (!exists) return res.status(404).json({ success: false, message: "File not found" });
    const [url] = await file.getSignedUrl({ action: "read", expires: "03-01-2035" });
    res.json({ success: true, url });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ---------- DELETE ----------
export const deleteByUrl = async (req, res) => {
  setCors(res);
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: "Missing url" });
    const decoded = decodeURIComponent(url);
    const match = decoded.match(/\/o\/([^?]+)\?/);
    const filePath = match?.[1];
    if (!filePath) return res.status(400).json({ success: false, message: "Invalid URL" });
    await bucket.file(filePath).delete({ ignoreNotFound: true });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};
