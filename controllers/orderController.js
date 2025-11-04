// controllers/orderController.js
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Cart from "../models/Cart.js";

export const ORDER_STATUSES = ["pending","confirmed","shipped","delivered","cancelled"];

// Create order (kept compatible with your existing payload)
export const createOrder = async (req, res) => {
  try {
    const { userId, items = [], address = "", phone = "", paymentMethod = "COD" } = req.body;
    if (!userId || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: "userId and items required" });
    }

    let subtotal = 0;
    const decrements = [];

    for (const it of items) {
      const pid = it.productId;
      const qty = Number(it.qty || 1);
      const size = String(it.size || "");
      const color = String(it.color || "");

      if (!pid || !size || !color || qty <= 0) {
        return res.status(400).json({ message: "Invalid item payload" });
      }

      const p = await Product.findById(pid);
      if (!p) return res.status(404).json({ message: "Product not found: " + pid });

      const vIdx = (p.variants || []).findIndex(v => v.size === size && v.color === color);
      if (vIdx < 0) return res.status(400).json({ message: `Variant not found for ${p.name} (${size}/${color})` });

      if (p.variants[vIdx].qty < qty) {
        return res.status(400).json({ message: `Insufficient stock for ${p.name} (${size}/${color})` });
      }
      decrements.push({ p, vIdx, qty });
      subtotal += Number(it.price || 0) * qty;
    }

    // Apply stock decrements
    for (const d of decrements) {
      d.p.variants[d.vIdx].qty -= d.qty;
      if (d.p.variants[d.vIdx].qty < 0) d.p.variants[d.vIdx].qty = 0;
      await d.p.save();
    }

    const shipping = Number(req.body.shipping ?? 0);
    const total = subtotal + shipping;

    const order = await Order.create({
      userId,
      items,
      subtotal,
      shipping,
      total,
      address,
      phone,
      paymentMethod,
      status: "pending",
    });

    // Clear cart
    await Cart.findOneAndDelete({ userId });

    return res.status(201).json(order);
  } catch (e) {
    console.error("createOrder error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

// List orders (optionally by userId and/or status)
export const listOrders = async (req, res) => {
  try {
    const { userId, status } = req.query;
    const q = {};
    if (userId) q.userId = userId;
    if (status && ORDER_STATUSES.includes(String(status))) q.status = String(status);

    const items = await Order.find(q).sort({ createdAt: -1 });
    return res.json({ items });
  } catch (e) {
    console.error("listOrders error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getOrder = async (req, res) => {
  try {
    const o = await Order.findById(req.params.id);
    if (!o) return res.status(404).json({ message: "Not found" });
    return res.json(o);
  } catch (e) {
    console.error("getOrder error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

// Admin: update order status
// controllers/orderController.js
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!ORDER_STATUSES.includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const o = await Order.findById(req.params.id);
    if (!o) return res.status(404).json({ message: "Order not found" });

    // 🟢 Restock only if switching to "cancelled" from non-cancelled
    if (status === "cancelled" && o.status !== "cancelled") {
      for (const it of o.items) {
        const p = await Product.findById(it.productId);
        if (!p) continue;
        const idx = p.variants.findIndex(v => v.size === it.size && v.color === it.color);
        if (idx >= 0) {
          p.variants[idx].qty += it.qty;
          await p.save();
        }
      }
    }

    o.status = status;
    await o.save();
    return res.json(o);
  } catch (e) {
    console.error("updateOrderStatus error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};


// User: cancel pending order (restock variants)
export const cancelOrder = async (req, res) => {
  try {
    const o = await Order.findById(req.params.id);
    if (!o) return res.status(404).json({ message: "Not found" });

    if (o.status !== "pending") {
      return res.status(400).json({ message: "Only pending orders can be cancelled" });
    }

    // Restock
    for (const it of o.items) {
      try {
        const p = await Product.findById(it.productId);
        if (!p) continue;
        const idx = (p.variants || []).findIndex(v => v.size == it.size && v.color == it.color);
        if (idx >= 0) {
          p.variants[idx].qty += Number(it.qty || 0);
          await p.save();
        }
      } catch (_) {}
    }

    o.status = "cancelled";
    await o.save();
    return res.json(o);
  } catch (e) {
    console.error("cancelOrder error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};
