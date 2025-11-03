import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import userRoutes from "./routes/userRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// ====== MIDDLEWARES ======
app.use(cors());
app.use(express.json());

// ====== DATABASE CONNECTION ======
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected Successfully");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  }
};
connectDB();

// ====== ROUTES ======
app.get("/", (req, res) => res.send("ElvaStore API Running 🚀"));
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/upload", uploadRoutes);

// ====== ERROR HANDLER (optional but recommended) ======
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err);
  res.status(500).json({ message: "Internal Server Error", error: err.message });
});

// ====== START SERVER ======
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
