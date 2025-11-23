import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

// =========================
// 🔐 Helper functions
// =========================
const createAccessToken = (user) => {
  return jwt.sign({ id: user._id, phone: user.phone }, process.env.JWT_SECRET, {
    expiresIn: process.env.TOKEN_EXPIRES || "15m",
  });
};

const createRefreshToken = (user) => {
  return jwt.sign({ id: user._id }, process.env.REFRESH_SECRET, {
    expiresIn: process.env.REFRESH_EXPIRES || "7d",
  });
};


// =========================
// 🟢 Signup
// =========================
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

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None", // ✅ required for Flutter web cookies
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      message: "Signup successful",
      token: accessToken,
	  refreshToken, 
      user,
    });
  } catch (err) {
    res.status(500).json({ message: "Signup failed", error: err.message });
  }
};

// =========================
// 🟢 Login
// =========================
export const login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: "Login successful",
      token: accessToken,
	  refreshToken, 
      user,
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
};

// =========================
// 🟢 Refresh token
// =========================
// =========================
// 🟢 Refresh token (supports cookie or header)
// =========================
export const refreshToken = async (req, res) => {
  try {
    let token = req.cookies?.refreshToken;

    // ✅ Also support header fallback (for mobile/web without cookies)
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) return res.status(401).json({ message: "No refresh token provided" });

    const decoded = jwt.verify(token, process.env.REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const newAccessToken = jwt.sign(
      { id: user._id, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: process.env.TOKEN_EXPIRES || "15m" }
    );

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error("refreshToken error:", err);
    res.status(403).json({ message: "Invalid or expired refresh token" });
  }
};


// =========================
// 📍 ADDRESS MANAGEMENT
// =========================

// 🟢 Get user addresses
export const getAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ addresses: user.addresses });
  } catch (err) {
    res.status(500).json({ message: "Error fetching addresses", error: err.message });
  }
};

// 🟢 Add new address
export const addAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const newAddress = req.body;

    // If new address is set as default, clear existing defaults
    if (newAddress.isDefault) {
      user.addresses.forEach(addr => (addr.isDefault = false));
    }

    user.addresses.push(newAddress);
    await user.save();
    res.json({ message: "Address added", addresses: user.addresses });
  } catch (err) {
    res.status(500).json({ message: "Error adding address", error: err.message });
  }
};

// 🟢 Set default address
export const setDefaultAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.addresses.forEach(addr => {
      addr.isDefault = addr._id.toString() === addressId;
    });

    await user.save();
    res.json({ message: "Default address updated", addresses: user.addresses });
  } catch (err) {
    res.status(500).json({ message: "Error updating default", error: err.message });
  }
};

// 🟢 Delete address
export const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.addresses = user.addresses.filter(addr => addr._id.toString() !== addressId);
    await user.save();
    res.json({ message: "Address deleted", addresses: user.addresses });
  } catch (err) {
    res.status(500).json({ message: "Error deleting address", error: err.message });
  }
};

// 🟢 Update existing address
export const updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const updates = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const addr = user.addresses.id(addressId);
    if (!addr) return res.status(404).json({ message: "Address not found" });

    // ✅ If the update marks as default, clear others
    if (updates.isDefault === true) {
      user.addresses.forEach((a) => (a.isDefault = false));
    }

    Object.assign(addr, updates); // merge fields
    await user.save();

    res.json({
  message: "Address updated",
  address: addr, // ✅ return only the updated one
});

  } catch (err) {
    res
      .status(500)
      .json({ message: "Error updating address", error: err.message });
  }
};

// 🟢 Update user name
export const updateName = async (req, res) => {
  try {
    const { name } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.name = name;
    await user.save();
    res.json({ message: "Name updated successfully", name: user.name });
  } catch (err) {
    res.status(500).json({ message: "Error updating name", error: err.message });
  }
};

// =========================
// 🟢 Logout
// =========================
export const logout = async (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: true,
    sameSite: "None",
  });
  res.json({ message: "Logged out successfully" });
};

// =========================
// 🟢 Change password
// =========================
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // ✅ Get authenticated user
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match)
      return res.status(400).json({ message: "Incorrect old password" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error updating password", error: err.message });
  }
};


// =========================
// 🟢 Forgot password (verify only phone)
// =========================
export const forgotPassword = async (req, res) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      message: "Phone verified. You can now reset your password.",
    });
  } catch (err) {
    res.status(500).json({
      message: "Error verifying phone",
      error: err.message,
    });
  }
};

// =========================
// 🟢 Reset password (direct reset)
// =========================
export const resetPassword = async (req, res) => {
  try {
    const { phone, newPassword } = req.body;
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error resetting password", error: err.message });
  }
};
