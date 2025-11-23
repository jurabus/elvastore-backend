import express from 'express';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductEnums,
  getNewArrivals,
  getProductsByBudget,
  requestNotify,
  getRequestedItems,
} from '../controllers/productController.js';
import { getUserBackInStock } from "../controllers/productController.js";

const router = express.Router();

router.get("/enums", getProductEnums);

// NEW: must come before '/:id'
router.get("/user-notifications/:userId", getUserBackInStock);

router.get('/new-arrivals', getNewArrivals);
router.get('/by-budget', getProductsByBudget);
router.post("/notify", requestNotify);
router.get("/requested-items", getRequestedItems);

router.get('/', getProducts);
router.get('/:id', getProduct);

router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

export default router;
