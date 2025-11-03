import Product from '../models/Product.js';

// GET /api/products?search=&category=&featured=true
export const getProducts = async (req, res) => {
  const { search, category, featured } = req.query;
  const q = { active: true };
  if (category) q.category = category;
  if (featured === 'true') q.featured = true;
  if (search) q.name = { $regex: search, $options: 'i' };

  const items = await Product.find(q).sort({ createdAt: -1 });
  res.json({ items, total: items.length });
};

// GET /api/products/:id
export const getProduct = async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: 'Product not found' });
  res.json(p);
};

// POST /api/products  (expects JSON body with fields; imageUrl can be from /api/upload)
export const createProduct = async (req, res) => {
  const { name, color, size, price, category, imageUrl, featured, active } = req.body;
  if (!name || !price || !category)
    return res.status(400).json({ message: 'name, price, category are required' });

  const prod = await Product.create({
    name, color, size, price, category,
    imageUrl: imageUrl || '',
    featured: !!featured,
    active: active !== false
  });
  res.status(201).json(prod);
};

// PUT /api/products/:id
export const updateProduct = async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: 'Product not found' });

  const fields = ['name','color','size','price','category','imageUrl','featured','active'];
  fields.forEach(k => { if (req.body[k] !== undefined) p[k] = req.body[k]; });
  await p.save();
  res.json(p);
};

// DELETE /api/products/:id
export const deleteProduct = async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: 'Product not found' });
  await p.deleteOne();
  res.json({ message: 'Deleted' });
};
