import mongoose from "mongoose";
import Category from "./Category.js"; // ✅ import Category for dynamic validation

// ✅ Full color palette (matches Flutter predefinedColors)
export const COLOR_ENUM = [
  "Black",
  "White",
  "Beige",
  "Cream",
  "Brown",
  "Red",
  "Pink",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "Grey",
  "Navy",
  "Gold",
  "Silver",
  "Cafe",
  "Mustard",
  "Burgundy",
  "Fluorescent Pink",
  "Offwhite",
  "Olive",
  "Brick Color",

];

// ========================= VARIANT SCHEMA =========================
const variantSchema = new mongoose.Schema(
  {
    color: {
      type: String,
      required: [true, "Variant color is required"],
      enum: COLOR_ENUM,
      trim: true,
    },
    size: {
      type: String,
      required: [true, "Variant size is required"],
      trim: true,
      maxlength: 10,
    }, // XS, S, M, L, XL, etc.
    qty: {
      type: Number,
      required: [true, "Variant quantity is required"],
      min: [0, "Quantity cannot be negative"],
    },
  },
  { _id: false }
);

// ========================= PRODUCT SCHEMA =========================
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      index: true, // ✅ keep index for searching
      minlength: 2,
      maxlength: 120,
    },
    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price must be positive"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      index: true,
      // ✅ dynamic validator to ensure category exists
      validate: {
        validator: async function (v) {
          if (!v) return false;
          const exists = await Category.exists({ name: v });
          return !!exists;
        },
        message: (props) => `Category '${props.value}' does not exist.`,
      },
    },
    images: {
      type: [String],
      validate: {
        validator: (arr) =>
          arr.every((url) => /^https?:\/\/[^\s]+$/i.test(url)),
        message: "One or more image URLs are invalid",
      },
      default: [],
    },
    featured: { type: Boolean, default: false },
    variants: {
      type: [variantSchema],
      validate: {
        validator: (arr) => arr.length > 0,
        message: "At least one variant is required",
      },
      default: [],
    },
  },
  { timestamps: true }
);

// ========================= INDEXES =========================
productSchema.index({ name: "text", category: 1, featured: 1 });
productSchema.index({ createdAt: -1 });

// ========================= VIRTUALS =========================
productSchema.virtual("totalQty").get(function () {
  return (this.variants || []).reduce((sum, v) => sum + Number(v.qty || 0), 0);
});

// ========================= CLEAN SERIALIZATION =========================
productSchema.methods.sanitize = function () {
  const o = this.toObject({ virtuals: true });
  delete o.__v;
  return o;
};

productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

// ========================= PRE-SAVE SANITIZATION =========================
productSchema.pre("save", function (next) {
  // remove invalid variants automatically
  if (Array.isArray(this.variants)) {
    this.variants = this.variants.filter(
      (v) => v.color && v.size && v.qty >= 0
    );
  }
  // deduplicate images
  if (Array.isArray(this.images)) {
    this.images = [...new Set(this.images)];
  }
  next();
});

// ========================= EXPORT =========================
const Product = mongoose.model("Product", productSchema);
export default Product;
