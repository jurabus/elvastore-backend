import express from "express";
import {
  uploadImageStream,
  uploadMultipleStream,
  getUploadUrl,
  getReadUrl,
  deleteByUrl,
  corsPreflight,
} from "../controllers/uploadController.js";

const router = express.Router();

// multipart (legacy) — single or multiple
router.post("/", uploadImageStream);          // single
router.post("/multi", uploadMultipleStream);  // multiple

// direct-upload flow (for presigned PUTs)
router.post("/prepare", getUploadUrl);
router.post("/complete", getReadUrl);

router.delete("/", deleteByUrl);
router.options(["/", "/multi", "/prepare", "/complete"], corsPreflight);

export default router;
