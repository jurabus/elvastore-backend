import mongoose from "mongoose";

const variantSchema = new mongoose.Schema(
  {
    color: { type: String, required: true, trim: true }, // e.g. "Red"
    size:  { type: String, required: true, trim: true }, // e.g. "M"
    qty:   { type: Number, required: true, min: 0 },     // stock for this color+size
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, index: true },
    price:    { type: Number, required: true, min: 0 },
    category: { type: String, required: true, index: true },
    images:   [String],
    featured: { type: Boolean, default: false },

    // 🔑 Authoritative inventory at the variant level
    variants: { type: [variantSchema], default: [] },
  },
  { timestamps: true }
);

// Virtual total quantity
productSchema.virtual("totalQty").get(function () {
  return (this.variants || []).reduce((sum, v) => sum + Number(v.qty || 0), 0);
});

productSchema.set("toJSON",  { virtuals: true });
productSchema.set("toObject",{ virtuals: true });

const Product = mongoose.model("Product", productSchema);
export default Product;
