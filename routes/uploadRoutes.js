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

router.post("/", uploadImageStream);        // single
router.post("/multi", uploadMultipleStream); // multi
router.post("/prepare", getUploadUrl);
router.post("/complete", getReadUrl);
router.delete("/", deleteByUrl);
router.options(["/", "/multi", "/prepare", "/complete"], corsPreflight);

export default router;
