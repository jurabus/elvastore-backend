import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      unique: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    imageUrl: {
      type: String,
      default: "",
      validate: {
        validator: (v) => !v || /^https?:\/\/[^\s]+$/i.test(v),
        message: "Invalid image URL",
      },
    },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

categorySchema.index({ name: 1 }, { unique: true });

// cleaner JSON for Flutter
categorySchema.methods.sanitize = function () {
  const o = this.toObject();
  delete o.__v;
  return o;
};

categorySchema.set("toJSON", { virtuals: true });
categorySchema.set("toObject", { virtuals: true });

export default mongoose.model("Category", categorySchema);
