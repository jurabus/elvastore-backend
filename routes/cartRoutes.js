// routes/cartRoutes.js
import express from "express";
import {
  getCart,
  addToCart,
  updateQty,
  clearCart,
  mergeCart,          // NEW
  checkoutPreview,    // NEW
} from "../controllers/cartController.js";

const router = express.Router();

router.get("/:userId", getCart);
router.get("/:userId/preview", checkoutPreview); // NEW
router.post("/", addToCart);
router.post("/merge", mergeCart);                 // NEW
router.put("/qty", updateQty);
router.delete("/:userId", clearCart);

export default router;
