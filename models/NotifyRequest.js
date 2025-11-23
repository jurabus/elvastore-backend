import mongoose from "mongoose";

const notifyRequestSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    userId: { type: String, required: true },
  },
  { timestamps: true }
);

notifyRequestSchema.index({ productId: 1, userId: 1 }, { unique: true });

const NotifyRequest = mongoose.model("NotifyRequest", notifyRequestSchema);
export default NotifyRequest;
