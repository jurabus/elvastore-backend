// controllers/productController.js
import Product, { COLOR_ENUM, CATEGORY_ENUM } from "../models/Product.js";

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
// --- CRUD ---
// GET /api/products?search=&category=&featured=true
export const getProducts = async (req, res) => {
  try {
    const { search, category, featured } = req.query;
    const q = {};
    if (category && CATEGORY_ENUM.includes(category)) q.category = category;
    if (featured === "true") q.featured = true;
    if (search) q.name = { $regex: search, $options: "i" };

    const items = await Product.find(q).sort({ createdAt: -1 });
    return res.json({ items: items.map(summarizeAvailability) });
  } catch (e) {
    console.error("getProducts error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/products/:id
export const getProduct = async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: "Product not found" });
    return res.json(summarizeAvailability(p));
  } catch (e) {
    console.error("getProduct error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

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

// --- NEW: New Arrivals (last N days, default 7) ---
// GET /api/products/new-arrivals?days=7&limit=20&category=...
export const getNewArrivals = async (req, res) => {
  try {
    const rawDays = Number(req.query.days ?? 7);
    const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 30) : 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rawLimit = Number(req.query.limit ?? 20);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 20;

    const q = { createdAt: { $gte: since } };
    const { category, search } = req.query;

    if (category && CATEGORY_ENUM.includes(category)) q.category = category;
    if (search) q.name = { $regex: String(search), $options: "i" };

    const items = await Product.find(q).sort({ createdAt: -1 }).limit(limit);
    return res.json({ items: items.map(summarizeAvailability), days });
  } catch (e) {
    console.error("getNewArrivals error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- NEW: Products by Budget Cap ---
// GET /api/products/by-budget?max=500&sort=price_desc|price_asc|created&search=&category=
export const getProductsByBudget = async (req, res) => {
  try {
    const max = Number(req.query.max ?? req.query.maxPrice);
    if (!Number.isFinite(max) || max <= 0) {
      return res.status(400).json({ message: "Query param 'max' must be a positive number" });
    }

    const { search, category } = req.query;
    const sortParam = String(req.query.sort || "created").toLowerCase();

    let sort = { createdAt: -1 };
    if (sortParam === "price_desc") sort = { price: -1 };
    else if (sortParam === "price_asc") sort = { price: 1 };

    const q = { price: { $lte: max } };
    if (category && CATEGORY_ENUM.includes(category)) q.category = category;
    if (search) q.name = { $regex: String(search), $options: "i" };

    const items = await Product.find(q).sort(sort);
    return res.json({ items: items.map(summarizeAvailability), max });
  } catch (e) {
    console.error("getProductsByBudget error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/products/:id
export const deleteProduct = async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: "Product not found" });

    // Best-effort image cleanup via internal API (works when uploadRoutes is mounted)
    const images = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
    try {
      if (images.length) {
        // Node 18+ has global fetch
        const base = `${req.protocol}://${req.get("host")}`;
        await Promise.all(
          images.map((url) =>
            fetch(`${base}/api/upload`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url }),
            }).catch(() => null)
          )
        );
      }
    } catch (_) {
      // ignore cleanup errors, we still delete product
    }

    await p.deleteOne();
    return res.json({ message: "Deleted", deletedImages: images.length });
  } catch (e) {
    console.error("deleteProduct error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- ENUMS ENDPOINT ---
// GET /api/products/enums
export const getProductEnums = async (req, res) => {
  try {
    return res.json({
      categories: CATEGORY_ENUM,
      colors: COLOR_ENUM,
    });
  } catch (e) {
    console.error("getProductEnums error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};
