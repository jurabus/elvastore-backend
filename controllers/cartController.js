// controllers/cartController.js
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

/* ------------------------ helpers ------------------------ */
const getVariantAvailability = (product, size, color) => {
  if (!product) return { availableQty: 0 };
  const variants = Array.isArray(product.variants) ? product.variants : [];

  if ((size && size !== "") || (color && color !== "")) {
    const v = variants.find(
      (vv) =>
        String(vv.size || "") === String(size || "") &&
        String(vv.color || "") === String(color || "")
    );
    return { availableQty: Number(v?.qty || 0) };
  }

  const total = variants.reduce((s, v) => s + Number(v.qty || 0), 0);
  return { availableQty: total };
};

const enrichCartDoc = async (cartDoc) => {
  if (!cartDoc) return { userId: null, items: [] };

  const items = await Promise.all(
    (cartDoc.items || []).map(async (i) => {
      let product = null;
      if (i.productId) product = await Product.findById(i.productId).lean();

      const { availableQty } = getVariantAvailability(product, i.size, i.color);
      const isOutOfStock = availableQty <= 0;

      const safeName = i.name || product?.name || "";
      const safePrice = i.price ?? product?.price ?? 0;
      let safeImage = i.imageUrl;
      if (!safeImage && Array.isArray(product?.images) && product.images.length) {
        safeImage = product.images[0];
      }

      return {
        ...((typeof i.toObject === "function") ? i.toObject() : i),
        name: safeName,
        price: safePrice,
        imageUrl: safeImage || "",
        isOutOfStock,
        availableQty,
      };
    })
  );

  return {
    userId: cartDoc.userId,
    items,
    updatedAt: cartDoc.updatedAt,
    createdAt: cartDoc.createdAt,
  };
};

/* ------------------------ endpoints ------------------------ */

// GET /api/cart/:userId
export const getCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const cart = await Cart.findOne({ userId });
    const enriched = await enrichCartDoc(cart || { userId, items: [] });
    return res.status(200).json(enriched);
  } catch (err) {
    console.error("getCart error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/cart
export const addToCart = async (req, res) => {
  try {
    const { userId, item } = req.body;
    if (!userId || !item?.name)
      return res.status(400).json({ message: "userId and item required" });

    let cart = await Cart.findOne({ userId });
    if (!cart) cart = new Cart({ userId, items: [] });

    const existing = cart.items.find(
      (i) => i.name === item.name && i.size === item.size && i.color === item.color
    );

    if (existing) {
      existing.qty += Number(item.qty || 1);
    } else {
      cart.items.push({
        productId: item.productId || undefined,
        name: item.name,
        price: Number(item.price || 0),
        qty: Number(item.qty || 1),
        size: String(item.size || ""),
        color: String(item.color || ""),
        imageUrl: String(item.imageUrl || ""),
      });
    }

    await cart.save();
    const enriched = await enrichCartDoc(cart);
    return res.status(200).json({ success: true, cart: enriched });
  } catch (err) {
    console.error("addToCart error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/cart/qty
export const updateQty = async (req, res) => {
  try {
    const { userId, productName, size, color, qty } = req.body;
    if (!userId || !productName)
      return res.status(400).json({ message: "Invalid data" });

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const idx = cart.items.findIndex(
      (i) => i.name === productName && i.size === size && i.color === color
    );
    if (idx === -1) return res.status(404).json({ message: "Item not found" });

    if (qty <= 0) {
      cart.items.splice(idx, 1);
    } else {
      cart.items[idx].qty = Number(qty);
    }

    await cart.save();
    const enriched = await enrichCartDoc(cart);
    return res.status(200).json({ success: true, cart: enriched });
  } catch (err) {
    console.error("updateQty error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/cart/:userId
export const clearCart = async (req, res) => {
  try {
    const { userId } = req.params;
    // 🟢 Don’t delete the document — just clear items
    const cart = await Cart.findOne({ userId });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("clearCart error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/cart/merge (guest → user)
export const mergeCart = async (req, res) => {
  try {
    const { userId, items } = req.body;
    if (!userId || !Array.isArray(items))
      return res.status(400).json({ message: "userId and items required" });

    let cart = await Cart.findOne({ userId });
    if (!cart) cart = new Cart({ userId, items: [] });

    for (const it of items) {
      if (!it?.name) continue;
      const existing = cart.items.find(
        (i) => i.name === it.name && i.size === (it.size || "") && i.color === (it.color || "")
      );
      if (existing) {
        existing.qty += Number(it.qty || 1);
      } else {
        cart.items.push({
          productId: it.productId || undefined,
          name: it.name,
          price: Number(it.price || 0),
          qty: Number(it.qty || 1),
          size: String(it.size || ""),
          color: String(it.color || ""),
          imageUrl: String(it.imageUrl || ""),
        });
      }
    }

    await cart.save();
    const enriched = await enrichCartDoc(cart);
    return res.status(200).json({ success: true, cart: enriched });
  } catch (err) {
    console.error("mergeCart error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/cart/:userId/preview
export const checkoutPreview = async (req, res) => {
  try {
    const { userId } = req.params;
    const cart = await Cart.findOne({ userId });
    const enriched = await enrichCartDoc(cart || { userId, items: [] });

    const purchasableItems = [];
    const soldOutItems = [];

    for (const it of enriched.items) {
      if (it.isOutOfStock || (it.availableQty ?? 0) <= 0) soldOutItems.push(it);
      else {
        const finalQty = Math.min(Number(it.qty || 1), Number(it.availableQty || 0));
        purchasableItems.push({ ...it, qty: finalQty });
      }
    }

    const subtotal = purchasableItems.reduce(
      (s, i) => s + Number(i.price || 0) * Number(i.qty || 0),
      0
    );

    return res.status(200).json({
      userId,
      purchasableItems,
      soldOutItems,
      totals: { subtotal },
    });
  } catch (err) {
    console.error("checkoutPreview error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
