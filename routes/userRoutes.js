import express from "express";
import {
  signup,
  login,
  logout,
  refreshToken,
  changePassword,
  forgotPassword,
  resetPassword,
} from "../controllers/userController.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// 🧾 AUTH ROUTES
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.get("/refresh", refreshToken); // 🔁 auto-renew access token

// 🔒 PASSWORD MANAGEMENT ROUTES
router.put("/change-password", verifyToken, changePassword);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
