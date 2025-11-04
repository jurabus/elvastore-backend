// controllers/productController.js
import Product from "../models/Product.js";
import Category from "../models/Category.js";

// --- helpers ---
const coerceImages = (body) => {
  const imgs = Array.isArray(body.images) ? body.images.filter(Boolean) : [];
  if (!imgs.length && body.imageUrl) imgs.push(String(body.imageUrl));
  return imgs;
};

const coerceVariants = (body) => {
  const raw = Array.isArray(body.variants) ? body.variants : [];
  const variants = raw
    .map((v) => ({
      color: String(v?.color || "").trim(),
      size: String(v?.size || "").trim(),
      qty: Number(v?.qty ?? 0),
    }))
    .filter((v) => v.color && v.size && v.qty > 0);
  return variants;
};

// Compute size/color summary + total stock
const summarizeAvailability = (p) => {
  const obj = p.toObject({ virtuals: true });
  const sizes = new Map();
  const colors = new Map();
  for (const v of obj.variants || []) {
    const q = Number(v.qty || 0);
    if (q > 0) {
      sizes.set(v.size, (sizes.get(v.size) || 0) + q);
      colors.set(v.color, (colors.get(v.color) || 0) + q);
    }
  }
  return {
    ...obj,
    totalQty: (obj.variants || []).reduce((s, v) => s + Number(v.qty || 0), 0),
    availableSizes: Array.from(sizes, ([size, qty]) => ({ size, qty })),
    availableColors: Array.from(colors, ([color, qty]) => ({ color, qty })),
  };
};

// ======================= CRUD =======================

// POST /api/products
export const createProduct = async (req, res) => {
  try {
    const variants = coerceVariants(req.body);
    if (!variants.length) {
      return res.status(400).json({ message: "At least one variant required (color, size, qty > 0)" });
    }

    const payload = {
      name: String(req.body.name || "").trim(),
      price: Number(req.body.price ?? 0),
      category: String(req.body.category || "").trim(),
      featured: !!req.body.featured,
      images: coerceImages(req.body),
      variants,
    };

    if (!payload.name || !payload.category) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const p = await Product.create(payload);
    return res.status(201).json(summarizeAvailability(p));
  } catch (e) {
    console.error("createProduct error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/products/:id
export const updateProduct = async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: "Not found" });

    if (req.body.name) p.name = req.body.name.trim();
    if (req.body.price != null) p.price = Number(req.body.price);
    if (req.body.category) p.category = String(req.body.category).trim();
    if (req.body.images) p.images = coerceImages(req.body);

    if (req.body.variants) {
      const v = coerceVariants(req.body);
      if (!v.length)
        return res.status(400).json({ message: "At least one valid variant required" });
      p.variants = v;
    }

    await p.save();
    return res.json(summarizeAvailability(p));
  } catch (e) {
    console.error("updateProduct error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};
