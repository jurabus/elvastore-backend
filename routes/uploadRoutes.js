import express from "express";
import { uploadImage, deleteByUrl } from "../controllers/uploadController.js";

const router = express.Router();

router.post("/", uploadImage);
router.delete("/", deleteByUrl);

// Handle CORS preflight (important for Flutter Web)
router.options("/", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.sendStatus(200);
});

export default router;
