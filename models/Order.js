// models/Order.js
import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: String,
    price: Number,
    qty: { type: Number, min: 1, default: 1 },
    size: String,
    color: String,
    imageUrl: String,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    items: { type: [orderItemSchema], default: [] },

    subtotal: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    total: { type: Number, default: 0 },

    // 🏠 Structured address fields
    address: { type: String, default: "" },
    fullAddress: { type: mongoose.Schema.Types.Mixed, default: null },

    phone: { type: String, default: "" },
    paymentMethod: { type: String, default: "COD" },
    status: { type: String, default: "pending", index: true },

    // 🧩 Added fields to fix crash and support audit trail
    statusChangedBy: { type: String, default: "System" },
    statusHistory: {
      type: [
        {
          status: { type: String },
          changedBy: { type: String },
          changedAt: { type: Date, default: Date.now },
        },
      ],
      default: [], // <== ✅ prevents undefined .push()
    },
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
