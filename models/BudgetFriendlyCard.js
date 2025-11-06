// models/BudgetFriendlyCard.js
import mongoose from "mongoose";

const budgetFriendlyCardSchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },        // e.g. "Under 500 EGP"
    imageUrl: { type: String, required: true },  // shown on the card
    maxPrice: { type: Number, required: true },  // price cap for products
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },         // optional manual ordering
  },
  { timestamps: true }
);

export default mongoose.model("BudgetFriendlyCard", budgetFriendlyCardSchema);
