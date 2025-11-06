// models/User.js
import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
  label: { type: String, default: "Home" }, // optional user label
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  city: { type: String, required: true },
  street: { type: String, required: true },
  building: { type: String },
  notes: { type: String },
  isDefault: { type: Boolean, default: false },
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: "New User" },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    verified: { type: Boolean, default: false },
    addresses: [addressSchema], // 🆕 list of addresses
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
