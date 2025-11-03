import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

/**
 * GET /api/cart/:userId
 * Fetch cart by userId
 */
export const getCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const cart = await Cart.findOne({ userId });
    return res.status(200).json(cart || { userId, items: [] });
  } catch (err) {
    console.error("getCart error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

//**
 * POST /api/cart
 * Add or update a product in the cart
 * body: { userId, item: { productId?, name, price, size, color, qty, imageUrl } }
 */
export const addToCart = async (req, res) => {
  try {
    const { userId, item } = req.body;
    if (!userId || !item?.name)
      return res.status(400).json({ message: "userId and item required" });

    // Optional: validate stock if productId + (size,color) present
    if (item.productId && (item.size || item.color)) {
      const p = await Product.findById(item.productId);
      if (!p) return res.status(404).json({ message: "Product not found" });

      const variant = (p.variants || []).find(
        (v) => v.size === String(item.size || "") && v.color === String(item.color || "")
      );
      if (!variant || variant.qty <= 0) {
        return res.status(400).json({ message: "Selected variant is out of stock" });
      }
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) cart = new Cart({ userId, items: [] });

    const existing = cart.items.find(
      (i) =>
        i.name === item.name &&
        i.size === item.size &&
        i.color === item.color
    );

    if (existing) {
      existing.qty += Number(item.qty || 1);
    } else {
      cart.items.push({
        productId: item.productId || undefined,
        name:  item.name,
        price: Number(item.price || 0),
        qty:   Number(item.qty || 1),
        size:  String(item.size || ""),
        color: String(item.color || ""),
        imageUrl: String(item.imageUrl || ""),
      });
    }

    await cart.save();
    return res.status(200).json({ success: true, cart });
  } catch (err) {
    console.error("addToCart error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * PUT /api/cart/qty
 * Update quantity of an item in cart
 */
export const updateQty = async (req, res) => {
  try {
    const { userId, productName, size, color, qty } = req.body;
    if (!userId || !productName)
      return res.status(400).json({ message: "Invalid data" });

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const item = cart.items.find(
      (i) => i.name === productName && i.size === size && i.color === color
    );
    if (!item) return res.status(404).json({ message: "Item not found" });

    if (qty <= 0) {
      cart.items = cart.items.filter(
        (i) => !(i.name === productName && i.size === size && i.color === color)
      );
    } else {
      item.qty = qty;
    }

    await cart.save();
    return res.status(200).json({ success: true, cart });
  } catch (err) {
    console.error("updateQty error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * DELETE /api/cart/:userId
 * Clear the user's cart
 */
export const clearCart = async (req, res) => {
  try {
    const { userId } = req.params;
    await Cart.findOneAndDelete({ userId });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("clearCart error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
