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

// 🧩 when admin changes status
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!ORDER_STATUSES.includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const o = await Order.findById(req.params.id);
    if (!o) return res.status(404).json({ message: "Order not found" });

    const prevStatus = o.status;
    if (status === prevStatus) return res.json(o);

    if (status === "cancelled" && prevStatus !== "cancelled") {
      for (const it of o.items) await adjustStock(it.productId, it.size, it.color, it.qty);
    }
    if (prevStatus === "cancelled" && status !== "cancelled") {
      for (const it of o.items) await adjustStock(it.productId, it.size, it.color, -it.qty);
    }

    o.status = status;
    o.statusChangedBy = "Admin";
    o.statusHistory.push({ status, changedBy: "Admin" });
    await o.save();

    return res.json(o);
  } catch (e) {
    console.error("updateOrderStatus error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

// 🧩 when user cancels own order
export const cancelOrder = async (req, res) => {
  try {
    const o = await Order.findById(req.params.id);
    if (!o) return res.status(404).json({ message: "Not found" });
    if (o.status !== "pending")
      return res.status(400).json({ message: "Only pending orders can be cancelled" });

    for (const it of o.items)
      await adjustStock(it.productId, it.size, it.color, Number(it.qty || 0));

    o.status = "cancelled";
    o.statusChangedBy = "User";
    o.statusHistory.push({ status: "cancelled", changedBy: "User" });
    await o.save();

    return res.json(o);
  } catch (e) {
    console.error("cancelOrder error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};
/* ----------------------------------------------------------
   🛒 Create Order From Cart
---------------------------------------------------------- */
export const createOrderFromCart = async (req, res) => {
  try {
    const { userId, address, phone, paymentMethod } = req.body;
    if (!userId) return res.status(400).json({ message: "userId required" });

    const cart = await Cart.findOne({ userId });
    if (!cart || !cart.items.length)
      return res.status(400).json({ message: "Cart is empty" });

    const purchasable = [];
    const soldOut = [];
    const affectedProducts = new Map();

    for (const i of cart.items) {
      const product = i.productId
        ? await Product.findById(i.productId)
        : null;

      if (!product) {
        soldOut.push(i);
        continue;
      }

      const variant = product.variants?.find(
        (v) =>
          String(v.size || "") === String(i.size || "") &&
          String(v.color || "") === String(i.color || "")
      );

      const availableQty = variant
        ? variant.qty
        : product.variants?.reduce((a, v) => a + v.qty, 0) ?? 0;

      if (!variant || availableQty <= 0) {
        soldOut.push(i);
        continue;
      }

      const finalQty = Math.min(i.qty, availableQty);

      purchasable.push({ ...(i.toObject?.() ?? i), qty: finalQty });

      // Apply stock reduction — but only SAVE ONCE LATER
      variant.qty = Math.max(variant.qty - finalQty, 0);

      if (!affectedProducts.has(product._id.toString())) {
        affectedProducts.set(product._id.toString(), product);
      }
    }

    if (!purchasable.length) {
      return res.status(400).json({ message: "No in-stock items to order" });
    }

    // ✅ Save all modified products only ONCE
    for (const p of affectedProducts.values()) {
      await p.save();
    }

    const subtotal = purchasable.reduce(
      (s, i) => s + Number(i.price) * Number(i.qty),
      0
    );

    const shipping = 0;
    const total = subtotal + shipping;

    // 🧩 Detect structured JSON address
    let fullAddressObj = null;
    let addressString = address || "Not provided";

    try {
      if (typeof address === "string" && address.trim().startsWith("{")) {
        fullAddressObj = JSON.parse(address);
        addressString = `${fullAddressObj.street || ""}, ${fullAddressObj.city || ""}`;
      } else if (typeof address === "object" && address !== null) {
        fullAddressObj = address;
        addressString = `${address.street || ""}, ${address.city || ""}`;
      }
    } catch (e) {
      console.warn("Invalid address JSON:", e);
    }

    const order = await Order.create({
      userId,
      items: purchasable.map((p) => ({
        productId: p.productId,
        name: p.name,
        price: p.price,
        qty: p.qty,
        size: p.size,
        color: p.color,
        imageUrl: p.imageUrl,
      })),
      subtotal,
      shipping,
      total,
      address: addressString,
      fullAddress: fullAddressObj,
      phone: phone || "",
      paymentMethod: paymentMethod || "COD",
      status: "pending",
    });

    // keep only sold-out items in cart
    cart.items = cart.items.filter(
      (i) =>
        soldOut.findIndex(
          (s) =>
            String(s.name) === String(i.name) &&
            String(s.size) === String(i.size) &&
            String(s.color) === String(i.color)
        ) !== -1
    );
    await cart.save();

    return res.status(201).json({
      success: true,
      message: "Order created from cart",
      order,
      soldOutItems: soldOut,
    });
  } catch (err) {
    console.error("createOrderFromCart error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


/* ----------------------------------------------------------
   🛒 Create order (direct)
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

    // 🧩 Detect structured JSON address
    let fullAddressObj = null;
    let addressString = address || "Not provided";

    try {
      if (typeof address === "string" && address.trim().startsWith("{")) {
        fullAddressObj = JSON.parse(address);
        addressString = `${fullAddressObj.street || ""}, ${fullAddressObj.city || ""}`;
      } else if (typeof address === "object" && address !== null) {
        fullAddressObj = address;
        addressString = `${address.street || ""}, ${address.city || ""}`;
      }
    } catch (e) {
      console.warn("Invalid address JSON:", e);
    }

    const order = await Order.create({
      userId,
      items,
      subtotal,
      shipping,
      total,
      address: addressString,
      fullAddress: fullAddressObj, // 🆕
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

