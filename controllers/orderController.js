import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
/**
 * 🟢 POST /api/orders
 * Create a new order + atomically deduct variant quantities (best-effort)
 */
export const createOrder = async (req, res) => {
  try {
    const { userId, phone, address, paymentMethod = "COD", items = [] } = req.body;
    if (!userId || !phone || !address || !items.length)
      return res.status(400).json({ message: "Missing required fields" });

    // Normalize order items; carry productId when provided (recommended)
    const normalized = items.map((it) => ({
      productId: it.productId ? String(it.productId) : undefined,
      name:   String(it.name || ""),
      price:  Number(it.price || 0),
      qty:    Math.max(1, Number(it.qty || 1)),
      size:   String(it.size || ""),
      color:  String(it.color || ""),
      imageUrl: String(it.imageUrl || ""),
    }));

    // 1) Validate stock availability for every variant
    const outOfStock = [];
    const productCache = new Map(); // id -> product

    for (const it of normalized) {
      let product = null;

      if (it.productId) {
        if (!productCache.has(it.productId)) {
          productCache.set(it.productId, await Product.findById(it.productId));
        }
        product = productCache.get(it.productId);
      } else {
        // legacy fallback by name
        product = await Product.findOne({ name: it.name });
      }

      if (!product) {
        outOfStock.push({ item: it, reason: "Product not found" });
        continue;
      }

      const variant = (product.variants || []).find(
        (v) => v.size === it.size && v.color === it.color
      );

      if (!variant || variant.qty < it.qty) {
        outOfStock.push({
          item: it,
          reason: !variant ? "Variant not found" : `Only ${variant.qty} left`,
        });
      }
    }

    if (outOfStock.length) {
      return res.status(400).json({
        message: "Some items are out of stock",
        details: outOfStock,
      });
    }

    // 2) Deduct quantities (validated first → low risk of conflict)
    for (const it of normalized) {
      const prodId = it.productId
        ? it.productId
        : (await Product.findOne({ name: it.name }))?._id;

      if (!prodId) {
        return res.status(400).json({ message: `Product not found for ${it.name}` });
      }

      const result = await Product.updateOne(
        {
          _id: prodId,
          "variants.color": it.color,
          "variants.size": it.size,
          "variants.qty": { $gte: it.qty }, // guard against negative stock
        },
        { $inc: { "variants.$.qty": -it.qty } }
      );

      if (!result.modifiedCount) {
        // Extremely rare race: someone bought last unit between validation and update
        return res.status(409).json({
          message: "Stock just changed. Please review your cart.",
          item: it,
        });
      }
    }

    // 3) Create order
    const subtotal = normalized.reduce((sum, it) => sum + it.price * it.qty, 0);
    const shipping = 0;
    const total = subtotal + shipping;

    const order = await Order.create({
      userId,
      phone,
      address,
      paymentMethod,
      items: normalized,
      subtotal,
      shipping,
      total,
    });

    // 4) Clear user cart
    await Cart.findOneAndDelete({ userId });

    return res.status(201).json({ success: true, order });
  } catch (err) {
    console.error("createOrder error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * 🟢 GET /api/orders/all
 * Get all orders (Admin view)
 */
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    return res.status(200).json({ items: orders });
  } catch (err) {
    console.error("getAllOrders error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * 🟢 GET /api/orders/user/:userId
 * Get all orders for a specific user
 */
export const getOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await Order.find({ userId }).sort({ createdAt: -1 });
    return res.status(200).json({ items: orders });
  } catch (err) {
    console.error("getOrdersByUser error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * 🟢 GET /api/orders/:id
 * Get a single order by ID
 */
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    return res.status(200).json(order);
  } catch (err) {
    console.error("getOrderById error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * 🟢 PUT /api/orders/:id/status
 * Update order status (Admin)
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ message: "Order not found" });
    return res.status(200).json({ success: true, order });
  } catch (err) {
    console.error("updateOrderStatus error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * 🟢 PUT /api/orders/:id/address
 * Update delivery address (User)
 */
export const updateOrderAddress = async (req, res) => {
  try {
    const { address } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, { address }, { new: true });
    if (!order) return res.status(404).json({ message: "Order not found" });
    return res.status(200).json({ success: true, order });
  } catch (err) {
    console.error("updateOrderAddress error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
