// routes/budgetFriendlyRoutes.js
import express from "express";
import {
  getBudgetCards,
  getAllBudgetCards,
  createBudgetCard,
  updateBudgetCard,
  deleteBudgetCard,
  getBudgetCardProducts,
} from "../controllers/budgetFriendlyController.js";

const router = express.Router();

// Public (Home) list
router.get("/", getBudgetCards);

// Admin list (optional)
router.get("/all", getAllBudgetCards);

// Admin CRUD
router.post("/", createBudgetCard);
router.put("/:id", updateBudgetCard);
router.delete("/:id", deleteBudgetCard);

// Products for a specific card
router.get("/:id/products", getBudgetCardProducts);

export default router;
