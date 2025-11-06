// routes/orderRoutes.js
import express from "express";
import {
  createOrder, listOrders, getOrder, updateOrderStatus, cancelOrder,
  createOrderFromCart,  // ✅ add
} from "../controllers/orderController.js";

const router = express.Router();

router.get("/", listOrders);              // ?userId=&status=
router.get("/:id", getOrder);
router.post("/", createOrder);
router.post("/from-cart", createOrderFromCart); // ✅ add

// Admin change status
router.put("/:id/status", updateOrderStatus);

// User cancel (only pending)
router.post("/:id/cancel", cancelOrder);

export default router;
