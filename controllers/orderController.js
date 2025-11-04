// controllers/orderController.js
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Cart from "../models/Cart.js";

export const ORDER_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

/* ----------------------------------------------------------
   🧩 Helper: adjustStock(productId, size, color, delta)
   delta = negative to decrease, positive to restock
---------------------------------------------------------- */
const adjustStock = async (productId, size, color, delta) => {
  try {
    const p = await Product.findById(productId);
    if (!p) return false;
    const idx = p.variants.findIndex(v => v.size === size && v.color === color);
    if (idx >= 0) {
      p.variants[idx].qty = Math.max(0, (p.variants[idx].qty || 0) + delta);
      await p.save();
      return true;
    }
    return false;
  } catch (err) {
    console.error("adjustStock error:", err);
    return false;
  }
};

/* ----------------------------------------------------------
   🛒 Create order
   - Decreases variant stock
   - Clears user cart
---------------------------------------------------------- */
export const createOrder = async (req, res) => {
  try {
    const { userId, items = [], address = "", phone = "", paymentMethod = "COD" } = req.body;
    if (!userId || !Array.isArray(items) || !items.length)
      return res.status(400).json({ message: "userId and items required" });

    let subtotal = 0;
    const decrements = [];

    for (const it of items) {
      const { productId, qty, size, color } = it;
      if (!productId || !size || !color || !qty || qty <= 0)
        return res.status(400).json({ message: "Invalid item payload" });

      const p = await Product.findById(productId);
      if (!p) return res.status(404).json({ message: "Product not found: " + productId });

      const vIdx = p.variants.findIndex(v => v.size === size && v.color === color);
      if (vIdx < 0)
        return res.status(400).json({ message: `Variant not found for ${p.name} (${size}/${color})` });

      if (p.variants[vIdx].qty < qty)
        return res.status(400).json({ message: `Insufficient stock for ${p.name} (${size}/${color})` });

      decrements.push({ p, vIdx, qty });
      subtotal += Number(it.price || 0) * qty;
    }

    // Apply decrements
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

    // Clear user cart
    await Cart.findOneAndDelete({ userId });

    return res.status(201).json(order);
  } catch (e) {
    console.error("createOrder error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------------------------------------------
   📜 List Orders
---------------------------------------------------------- */
export const listOrders = async (req, res) => {
  try {
    const { userId, status } = req.query;
    const q = {};
    if (userId) q.userId = userId;
    if (status && ORDER_STATUSES.includes(status)) q.status = status;

    const items = await Order.find(q).sort({ createdAt: -1 });
    return res.json({ items });
  } catch (e) {
    console.error("listOrders error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------------------------------------------
   📦 Get Single Order
---------------------------------------------------------- */
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

/* ----------------------------------------------------------
   🧮 Admin: Update Order Status (smart stock sync)
---------------------------------------------------------- */
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!ORDER_STATUSES.includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const o = await Order.findById(req.params.id);
    if (!o) return res.status(404).json({ message: "Order not found" });

    const prevStatus = o.status;
    if (status === prevStatus)
      return res.json(o); // no change

    // 🟠 Transition from active → cancelled → restock
    if (status === "cancelled" && prevStatus !== "cancelled") {
      for (const it of o.items) await adjustStock(it.productId, it.size, it.color, it.qty);
    }

    // 🟢 Transition from cancelled → active → reduce again
    if (prevStatus === "cancelled" && status !== "cancelled") {
      for (const it of o.items) await adjustStock(it.productId, it.size, it.color, -it.qty);
    }

    o.status = status;
    await o.save();
    return res.json(o);
  } catch (e) {
    console.error("updateOrderStatus error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------------------------------------------
   ❌ User Cancel Own Order (if pending)
---------------------------------------------------------- */
export const cancelOrder = async (req, res) => {
  try {
    const o = await Order.findById(req.params.id);
    if (!o) return res.status(404).json({ message: "Not found" });
    if (o.status !== "pending")
      return res.status(400).json({ message: "Only pending orders can be cancelled" });

    // Restock each variant
    for (const it of o.items)
      await adjustStock(it.productId, it.size, it.color, Number(it.qty || 0));

    o.status = "cancelled";
    await o.save();
    return res.json(o);
  } catch (e) {
    console.error("cancelOrder error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};
