import express from 'express';

import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductEnums,
  // NEW
  getNewArrivals,
  getProductsByBudget,
} from '../controllers/productController.js';

const router = express.Router();

router.get("/enums", getProductEnums);

// NEW: must come before '/:id'
router.get('/new-arrivals', getNewArrivals);
router.get('/by-budget', getProductsByBudget);

router.get('/', getProducts);
router.get('/:id', getProduct);

router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

export default router;
