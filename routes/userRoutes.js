import express from 'express';

import { login, registerAdmin, getProfile, updateProfile, changePassword } from '../controllers/userController.js';

const router = express.Router();
router.post('/login', login);
router.post('/register-admin', registerAdmin); // one-time bootstrap
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);

export default router;
