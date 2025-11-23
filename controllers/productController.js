import Product, { COLOR_ENUM } from "../models/Product.js";
import NotifyRequest from "../models/NotifyRequest.js";

// =============== HELPERS ===============
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
  const totalQty = (obj.variants || []).reduce(
    (s, v) => s + Number(v.qty || 0),
    0
  );
  return { ...obj, totalQty };
};

// =============== CRUD ENDPOINTS ===============
// ✅ Get back-in-stock items for specific user
export const getUserBackInStock = async (req, res) => {
  try {
    const { userId } = req.params;

    const requests = await NotifyRequest.find({ userId });

    if (!requests.length) {
      return res.json({ items: [] });
    }

    const productIds = requests.map((r) => r.productId);

    const products = await Product.find({ _id: { $in: productIds } }).lean();

    const backInStock = [];

    for (const p of products) {
      const availableQty = (p.variants || []).reduce(
        (sum, v) => sum + Number(v.qty || 0),
        0
      );

      if (availableQty > 0) {
        backInStock.push({
          productId: p._id,
          name: p.name,
          imageUrl: p.images?.[0] || "",
          availableQty,
        });

        // auto cleanup
        await NotifyRequest.deleteOne({ userId, productId: p._id });
      }
    }

    return res.json({ items: backInStock });
  } catch (err) {
    console.error("getUserBackInStock error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// GET all
export const getProducts = async (req, res) => {
  try {
    const { search, category, featured } = req.query;
    const q = {};

    if (category) q.category = category;
    if (featured === "true") q.featured = true;
    if (search) q.name = { $regex: search, $options: "i" };

    const items = await Product.find(q).sort({ createdAt: -1 });
    res.json({ success: true, items: items.map(summarizeAvailability) });
  } catch (e) {
    console.error("getProducts error:", e);
    res.status(500).json({
      success: false,
      message: "Server error while fetching products",
    });
  }
};

//
export const getRequestedItems = async (req, res) => {
  try {
    const data = await NotifyRequest.find()
      .populate("productId", "name images")
      .lean();

    return res.status(200).json({ items: data });
  } catch (err) {
    console.error("getRequestedItems error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


//
export const requestNotify = async (req, res) => {
  try {
    const { userId, productId } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({ message: "userId and productId required" });
    }

    // ensure product exists
    const product = await Product.findById(productId).lean();
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const totalStock = (product.variants || []).reduce(
      (sum, v) => sum + Number(v.qty || 0),
      0
    );

    if (totalStock > 0) {
      return res.status(409).json({
        alreadyAvailable: true,
        message: "Product is already back in stock",
      });
    }

    const record = await NotifyRequest.findOneAndUpdate(
      { userId, productId },
      { userId, productId },
      { upsert: true, new: true }
    );

    return res.status(201).json({
      success: true,
      message: "Notify request saved",
      record,
    });
  } catch (err) {
    console.error("requestNotify error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// GET single
export const getProduct = async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    res.json({ success: true, item: summarizeAvailability(p) });
  } catch (e) {
    console.error("getProduct error:", e);
    res.status(500).json({
      success: false,
      message: "Server error while fetching product",
    });
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
      return res
        .status(400)
        .json({ success: false, message: "Product name is required" });
    if (!payload.category)
      return res
        .status(400)
        .json({ success: false, message: "Category is required" });
    if (!payload.images.length)
      return res
        .status(400)
        .json({ success: false, message: "At least one image required" });

    const product = await Product.create(payload);
    res.status(201).json({
      success: true,
      message: "Product created successfully",
      item: summarizeAvailability(product),
    });
  } catch (e) {
    console.error("createProduct error:", e);
    res.status(500).json({
      success: false,
      message: e.message || "Server error while creating product",
    });
  }
};

// UPDATE
export const updateProduct = async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });

    if (req.body.name) p.name = req.body.name.trim();
    if (req.body.price != null) p.price = Number(req.body.price);
    if (req.body.category) p.category = String(req.body.category).trim();
    if (req.body.images) p.images = coerceImages(req.body);

    if (req.body.variants) {
      const v = coerceVariants(req.body);
      if (!v.length)
        return res.status(400).json({
          success: false,
          message: "At least one valid variant required",
        });
      p.variants = v;
    }

    await p.save();

    // ✅ FIXED: use p, NOT product
    if (p.totalQty > 0) {
      const pending = await NotifyRequest.find({ productId: p._id });

      for (const req of pending) {
        await NotifyRequest.deleteOne({ _id: req._id });
      }

      console.log(
        `📢 Product ${p.name} is back in stock – ${pending.length} users notified`
      );
    }

    res.json({
      success: true,
      message: "Product updated successfully",
      item: summarizeAvailability(p),
    });
  } catch (e) {
    console.error("updateProduct error:", e);
    res.status(500).json({
      success: false,
      message: e.message || "Server error while updating product",
    });
  }
};


// DELETE
export const deleteProduct = async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });

    const images = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
    await p.deleteOne();

    res.json({
      success: true,
      message: `Product deleted (${images.length} images scheduled for cleanup)`,
    });
  } catch (e) {
    console.error("deleteProduct error:", e);
    res.status(500).json({
      success: false,
      message: e.message || "Server error while deleting product",
    });
  }
};

// =============== EXTRA ENDPOINTS ===============

// ENUMS (colors only now)
export const getProductEnums = async (req, res) => {
  try {
    res.json({ success: true, colors: COLOR_ENUM });
  } catch (e) {
    console.error("getProductEnums error:", e);
    res.status(500).json({
      success: false,
      message: "Server error while fetching enums",
    });
  }
};

// NEW ARRIVALS
export const getNewArrivals = async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days ?? 7), 1), 30);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 50);
    const q = { createdAt: { $gte: since } };

    const { category, search } = req.query;
    if (category) q.category = category;
    if (search) q.name = { $regex: search, $options: "i" };

    const items = await Product.find(q)
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json({ success: true, days, items: items.map(summarizeAvailability) });
  } catch (e) {
    console.error("getNewArrivals error:", e);
    res.status(500).json({
      success: false,
      message: "Server error while fetching new arrivals",
    });
  }
};

// PRODUCTS BY BUDGET
export const getProductsByBudget = async (req, res) => {
  try {
    const max = Number(req.query.max ?? req.query.maxPrice);
    if (!Number.isFinite(max) || max <= 0) {
      return res.status(400).json({
        success: false,
        message: "Query param 'max' must be a positive number",
      });
    }

    const { search, category, sort } = req.query;
    let sortOpt = { createdAt: -1 };
    if (sort === "price_asc") sortOpt = { price: 1 };
    if (sort === "price_desc") sortOpt = { price: -1 };

    const q = { price: { $lte: max } };
    if (category) q.category = category;
    if (search) q.name = { $regex: search, $options: "i" };

    const items = await Product.find(q).sort(sortOpt);
    res.json({ success: true, max, items: items.map(summarizeAvailability) });
  } catch (e) {
    console.error("getProductsByBudget error:", e);
    res.status(500).json({
      success: false,
      message: e.message || "Server error while filtering products by budget",
    });
  }
};
