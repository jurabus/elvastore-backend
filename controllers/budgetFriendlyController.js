// controllers/budgetFriendlyController.js
import BudgetFriendlyCard from "../models/BudgetFriendlyCard.js";
import Product, { CATEGORY_ENUM } from "../models/Product.js";
import { /* reuse helpers if needed */ } from "./productController.js"; // not required

// LIST active cards (for Home)
export const getBudgetCards = async (req, res) => {
  try {
    const cards = await BudgetFriendlyCard.find({ isActive: true })
      .sort({ order: 1, maxPrice: 1, createdAt: -1 });
    return res.json({ items: cards });
  } catch (e) {
    console.error("getBudgetCards error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

// (Optional) LIST all cards (admin view)
export const getAllBudgetCards = async (req, res) => {
  try {
    const cards = await BudgetFriendlyCard.find({})
      .sort({ order: 1, maxPrice: 1, createdAt: -1 });
    return res.json({ items: cards });
  } catch (e) {
    console.error("getAllBudgetCards error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

// CREATE a card
export const createBudgetCard = async (req, res) => {
  try {
    const { maxPrice, imageUrl, title, isActive, order } = req.body;
    if (!imageUrl || !Number.isFinite(Number(maxPrice))) {
      return res.status(400).json({ message: "imageUrl and numeric maxPrice are required" });
    }
    const card = await BudgetFriendlyCard.create({
      imageUrl: String(imageUrl),
      maxPrice: Number(maxPrice),
      title: String(title || `Under ${Number(maxPrice)} EGP`),
      isActive: !!isActive,
      order: Number.isFinite(Number(order)) ? Number(order) : 0,
    });
    return res.status(201).json(card);
  } catch (e) {
    console.error("createBudgetCard error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

// UPDATE a card
export const updateBudgetCard = async (req, res) => {
  try {
    const card = await BudgetFriendlyCard.findById(req.params.id);
    if (!card) return res.status(404).json({ message: "Not found" });

    const { maxPrice, imageUrl, title, isActive, order } = req.body;
    if (imageUrl != null) card.imageUrl = String(imageUrl);
    if (maxPrice != null && Number.isFinite(Number(maxPrice))) card.maxPrice = Number(maxPrice);
    if (title != null) card.title = String(title);
    if (isActive != null) card.isActive = !!isActive;
    if (order != null && Number.isFinite(Number(order))) card.order = Number(order);

    await card.save();
    return res.json(card);
  } catch (e) {
    console.error("updateBudgetCard error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

// DELETE a card
export const deleteBudgetCard = async (req, res) => {
  try {
    const card = await BudgetFriendlyCard.findById(req.params.id);
    if (!card) return res.status(404).json({ message: "Not found" });
    await card.deleteOne();
    return res.json({ message: "Deleted" });
  } catch (e) {
    console.error("deleteBudgetCard error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET products for a specific card (by its maxPrice)
// GET /api/budget-friendly/:id/products?sort=price_desc|price_asc|created&search=&category=
export const getBudgetCardProducts = async (req, res) => {
  try {
    const card = await BudgetFriendlyCard.findById(req.params.id);
    if (!card || !card.isActive) {
      return res.status(404).json({ message: "Card not found" });
    }

    const { search, category } = req.query;
    const sortParam = String(req.query.sort || "created").toLowerCase();

    let sort = { createdAt: -1 };
    if (sortParam === "price_desc") sort = { price: -1 };
    else if (sortParam === "price_asc") sort = { price: 1 };

    const q = { price: { $lte: card.maxPrice } };
    if (category && CATEGORY_ENUM.includes(category)) q.category = category;
    if (search) q.name = { $regex: String(search), $options: "i" };

    const items = await Product.find(q).sort(sort);
    return res.json({
      card: { id: card._id, title: card.title, maxPrice: card.maxPrice, imageUrl: card.imageUrl },
      items,
    });
  } catch (e) {
    console.error("getBudgetCardProducts error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};
