import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Helper to create JWT
const createToken = (user) => {
  return jwt.sign({ id: user._id, phone: user.phone }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// 🟢 Signup (phone + password)
export const signup = async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password)
      return res.status(400).json({ message: "Phone and password required" });

    const existing = await User.findOne({ phone });
    if (existing)
      return res.status(400).json({ message: "Phone already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ phone, password: hashed });
    const token = createToken(user);

    res.status(201).json({ message: "Signup successful", token, user });
  } catch (err) {
    res.status(500).json({ message: "Signup failed", error: err.message });
  }
};

// 🟢 Login (phone + password)
export const login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = createToken(user);
    res.json({ message: "Login successful", token, user });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
};

// 🟢 Change password
export const changePassword = async (req, res) => {
  try {
    const { phone, oldPassword, newPassword } = req.body;
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) return res.status(400).json({ message: "Incorrect old password" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error updating password", error: err.message });
  }
};

// 🟢 Forgot password (verify only phone)
export const forgotPassword = async (req, res) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      message: "Phone verified. You can now reset your password.",
    });
  } catch (err) {
    res.status(500).json({ message: "Error verifying phone", error: err.message });
  }
};

// 🟢 Reset password (direct)
export const resetPassword = async (req, res) => {
  try {
    const { phone, newPassword } = req.body;
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ message: "Error resetting password", error: err.message });
  }
};