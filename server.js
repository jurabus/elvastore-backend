import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import budgetFriendlyRoutes from "./routes/budgetFriendlyRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// ====== MIDDLEWARES ======
app.set("trust proxy", 1); // ✅ Required for cookies on HTTPS (Render/Netlify)
app.use(cookieParser());
app.use(express.json());

// ✅ CORS setup for Flutter Web (with cookies & tokens)
app.use(
  cors({
    origin: [
      "https://elvastore0.web.app",
      "https://elvastore0.firebaseapp.com",
      /http:\/\/localhost(:\d+)?$/,
      /http:\/\/127\.0\.0\.1(:\d+)?$/
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);




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
app.use("/api/budget-friendly", budgetFriendlyRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/categories", categoryRoutes);

// ====== ERROR HANDLER ======
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err);
  res
    .status(500)
    .json({ message: "Internal Server Error", error: err.message });
});

// ====== START SERVER ======
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
