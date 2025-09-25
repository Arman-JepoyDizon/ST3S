// File: routes/adminRoutes.js

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// --- Middleware for Admin Role Check ---
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'Admin') {
        return next();
    }
    res.redirect('/login'); 
};

router.use(isAdmin);

// --- Admin Routes ---

// Admin Dashboard Route
router.get('/dashboard', adminController.getDashboard);

// Product Management Routes
router.get('/products', adminController.getProducts);
router.get('/products/add', adminController.getAddProductPage);
router.post('/products/add', adminController.postAddProduct);
router.post('/products/delete/:id', adminController.deleteProduct); // This route is now active


module.exports = router;