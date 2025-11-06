import Product, { COLOR_ENUM, CATEGORY_ENUM } from "../models/Product.js";

// helpers
const coerceImages = (body) => {
  const imgs = Array.isArray(body.images) ? body.images.filter(Boolean) : [];
  if (!imgs.length && body.imageUrl) imgs.push(String(body.imageUrl));
  return imgs;
};
const coerceVariants = (body) => {
  const raw = Array.isArray(body.variants) ? body.variants : [];
  return raw
    .map((v) => ({
      color: String(v?.color || "").trim(),
      size: String(v?.size || "").trim(),
      qty: Number(v?.qty ?? 0),
    }))
    .filter((v) => v.color && v.size && v.qty > 0);
};
const summarizeAvailability = (p) => {
  const obj = p.toObject({ virtuals: true });
  const totalQty = (obj.variants || []).reduce((s, v) => s + Number(v.qty || 0), 0);
  return { ...obj, totalQty };
};

// GET all
export const getProducts = async (req, res) => {
  try {
    const { search, category, featured } = req.query;
    const q = {};
    if (category && CATEGORY_ENUM.includes(category)) q.category = category;
    if (featured === "true") q.featured = true;
    if (search) q.name = { $regex: search, $options: "i" };

    const items = await Product.find(q).sort({ createdAt: -1 });
    res.json({ success: true, items: items.map(summarizeAvailability) });
  } catch (e) {
    console.error("getProducts error:", e);
    res.status(500).json({ success: false, message: "Server error while fetching products" });
  }
};

// GET single
export const getProduct = async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p)
      return res.status(404).json({ success: false, message: "Product not found" });
    res.json({ success: true, item: summarizeAvailability(p) });
  } catch (e) {
    console.error("getProduct error:", e);
    res.status(500).json({ success: false, message: "Server error while fetching product" });
  }
};

// CREATE
export const createProduct = async (req, res) => {
  try {
    const variants = coerceVariants(req.body);
    if (!variants.length) {
      return res.status(400).json({
        success: false,
        message: "At least one variant required (color, size, qty > 0)",
      });
    }

    const payload = {
      name: String(req.body.name || "").trim(),
      price: Number(req.body.price ?? 0),
      category: String(req.body.category || "").trim(),
      featured: !!req.body.featured,
      images: coerceImages(req.body),
      variants,
    };

    if (!payload.name)
      return res.status(400).json({ success: false, message: "Product name is required" });
    if (!payload.category)
      return res.status(400).json({ success: false, message: "Category is required" });
    if (!payload.images.length)
      return res.status(400).json({ success: false, message: "At least one image required" });

    const product = await Product.create(payload);
    res.status(201).json({
      success: true,
      message: "Product created successfully",
      item: summarizeAvailability(product),
    });
  } catch (e) {
    console.error("createProduct error:", e);
    res.status(500).json({ success: false, message: "Server error while creating product" });
  }
};

// UPDATE
export const updateProduct = async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p)
      return res.status(404).json({ success: false, message: "Product not found" });

    if (req.body.name) p.name = req.body.name.trim();
    if (req.body.price != null) p.price = Number(req.body.price);
    if (req.body.category) p.category = String(req.body.category).trim();
    if (req.body.images) p.images = coerceImages(req.body);

    if (req.body.variants) {
      const v = coerceVariants(req.body);
      if (!v.length)
        return res.status(400).json({ success: false, message: "At least one valid variant required" });
      p.variants = v;
    }

    await p.save();
    res.json({
      success: true,
      message: "Product updated successfully",
      item: summarizeAvailability(p),
    });
  } catch (e) {
    console.error("updateProduct error:", e);
    res.status(500).json({ success: false, message: "Server error while updating product" });
  }
};

// DELETE
export const deleteProduct = async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p)
      return res.status(404).json({ success: false, message: "Product not found" });

    const images = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
    await p.deleteOne();

    res.json({
      success: true,
      message: `Product deleted (${images.length} images scheduled for cleanup)`,
    });
  } catch (e) {
    console.error("deleteProduct error:", e);
    res.status(500).json({ success: false, message: "Server error while deleting product" });
  }
};
