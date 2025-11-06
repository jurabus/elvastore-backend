import Category from "../models/Category.js";

// GET all
export const getCategories = async (req, res) => {
  try {
    const cats = await Category.find().sort({ createdAt: -1 });
    res.json({ success: true, items: cats });
  } catch (e) {
    console.error("getCategories error:", e);
    res.status(500).json({
      success: false,
      message: "Server error while fetching categories",
    });
  }
};

// CREATE
export const createCategory = async (req, res) => {
  try {
    const { name, imageUrl, featured } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Field 'name' is required" });
    }
    if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
      return res
        .status(400)
        .json({ success: false, message: "Valid 'imageUrl' is required" });
    }

    const exists = await Category.findOne({ name: name.trim() });
    if (exists)
      return res
        .status(400)
        .json({ success: false, message: "Category already exists" });

    const cat = await Category.create({
      name: name.trim(),
      imageUrl,
      featured: !!featured,
    });

    res.status(201).json({ success: true, message: "Category created", item: cat });
  } catch (e) {
    console.error("createCategory error:", e);
    res.status(500).json({
      success: false,
      message: "Server error while creating category",
    });
  }
};

// UPDATE
export const updateCategory = async (req, res) => {
  try {
    const cat = await Category.findById(req.params.id);
    if (!cat)
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });

    const { name, imageUrl, featured } = req.body;
    if (name !== undefined) cat.name = String(name).trim();
    if (imageUrl !== undefined) cat.imageUrl = String(imageUrl).trim();
    if (featured !== undefined) cat.featured = !!featured;

    await cat.save();
    res.json({ success: true, message: "Category updated", item: cat });
  } catch (e) {
    console.error("updateCategory error:", e);
    res.status(500).json({
      success: false,
      message: "Server error while updating category",
    });
  }
};

// DELETE
export const deleteCategory = async (req, res) => {
  try {
    const cat = await Category.findById(req.params.id);
    if (!cat)
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    await cat.deleteOne();
    res.json({ success: true, message: "Category deleted" });
  } catch (e) {
    console.error("deleteCategory error:", e);
    res.status(500).json({
      success: false,
      message: "Server error while deleting category",
    });
  }
};
