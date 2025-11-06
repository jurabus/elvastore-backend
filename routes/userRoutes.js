import {
  signup,
  login,
  logout,
  refreshToken,
  changePassword,
  forgotPassword,
  resetPassword,
  getAddresses,
  addAddress,
  setDefaultAddress,
  deleteAddress,
  updateName,
} from "../controllers/userController.js";

import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// 🧾 AUTH ROUTES
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.get("/refresh", refreshToken);

// 🔒 PASSWORD MANAGEMENT
router.put("/change-password", verifyToken, changePassword);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// 🏠 ADDRESS MANAGEMENT
router.get("/addresses", verifyToken, getAddresses);
router.post("/addresses", verifyToken, addAddress);
router.put("/addresses/default/:addressId", verifyToken, setDefaultAddress);
router.delete("/addresses/:addressId", verifyToken, deleteAddress);

// ✏️ PROFILE
router.put("/update-name", verifyToken, updateName);

export default router;
