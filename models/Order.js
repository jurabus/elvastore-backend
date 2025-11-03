import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    phone:  { type: String, required: true },
    address:{ type: String, required: true },
    paymentMethod: { type: String, default: "COD" },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" }, // NEW (recommended)
        name: String,
        price: Number,
        qty: Number,
        size: String,
        color: String,
        imageUrl: String,
      },
    ],
    subtotal: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    total:    { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
export default Order;
