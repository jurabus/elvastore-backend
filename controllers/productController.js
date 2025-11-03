// controllers/productController.js
import Product from "../models/Product.js";

// helper: normalize images (imageUrl → images[])
const coerceImages = (body) => {
  const imgs = Array.isArray(body.images) ? body.images.filter(Boolean) : [];
  if (!imgs.length && body.imageUrl) imgs.push(String(body.imageUrl));
  return imgs;
};

// helper: normalize variants from body (backward compatible)
const coerceVariants = (body) => {
  const raw = Array.isArray(body.variants) ? body.variants : [];
  let variants = raw
    .map((v) => ({
      color: String(v?.color || "").trim(),
      size:  String(v?.size  || "").trim(),
      qty:   Math.max(0, Number(v?.qty || 0)),
    }))
    .filter((v) => v.color && v.size && Number.isFinite(v.qty));

  // Fallback for legacy payloads (single color/size)
  if (!variants.length && (body.color || body.size)) {
    variants = [
      {
        color: String(body.color || "Default"),
        size:  String(body.size  || "OneSize"),
        qty:   Math.max(0, Number(body.qty || 0)),
      },
    ];
  }

  return variants;
};

// helper: availability summary for UI
const summarizeAvailability = (docOrPlain) => {
  const obj = docOrPlain.toObject ? docOrPlain.toObject({ virtuals: true }) : { ...docOrPlain };
  const sizes = new Map();
  const colors = new Map();

  (obj.variants || []).forEach((v) => {
    const q = Number(v.qty || 0);
    if (q > 0) {
      sizes.set(v.size,  (sizes.get(v.size)  || 0) + q);
      colors.set(v.color,(colors.get(v.color) || 0) + q);
    }
  });

  return {
    ...obj,
    totalQty: (obj.variants || []).reduce((s, v) => s + Number(v.qty || 0), 0),
    availableSizes:  Array.from(sizes,  ([size, qty])  => ({ size,  qty })),
    availableColors: Array.from(colors, ([color, qty]) => ({ color, qty })),
  };
};

// GET /api/products?search=&category=&featured=true
export const getProducts = async (req, res) => {
  const { search, category, featured } = req.query;
  const q = {};
  if (category) q.category = category;
  if (featured === "true") q.featured = true;
  if (search) q.name = { $regex: search, $options: "i" };

  const rows = await Product.find(q).sort({ createdAt: -1 });
  const items = rows.map(summarizeAvailability);
  res.json({ items, total: items.length });
};

// GET /api/products/:id
export const getProduct = async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Product not found" });
  return res.json(summarizeAvailability(p));
};

// POST /api/products
export const createProduct = async (req, res) => {
  const { name, price, category, featured } = req.body;
  if (!name || price == null || !category)
    return res.status(400).json({ message: "name, price, category are required" });

  const prod = await Product.create({
    name:     String(name),
    price:    Number(price),
    category: String(category),
    images:   coerceImages(req.body),
    featured: !!featured,
    variants: coerceVariants(req.body),
  });

  return res.status(201).json(summarizeAvailability(prod));
};

// PUT /api/products/:id
export const updateProduct = async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Product not found" });

  // allow updates
  if (req.body.name      !== undefined) p.name     = String(req.body.name);
  if (req.body.price     !== undefined) p.price    = Number(req.body.price);
  if (req.body.category  !== undefined) p.category = String(req.body.category);
  if (req.body.featured  !== undefined) p.featured = !!req.body.featured;
  if (req.body.images    !== undefined || req.body.imageUrl !== undefined)
    p.images = coerceImages(req.body);
  if (req.body.variants  !== undefined)
    p.variants = coerceVariants(req.body);

  await p.save();
  return res.json(summarizeAvailability(p));
};

// DELETE /api/products/:id
export const deleteProduct = async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Product not found" });
  await p.deleteOne();
  res.json({ message: "Deleted" });
};
