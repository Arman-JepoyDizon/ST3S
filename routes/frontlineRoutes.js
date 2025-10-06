// File: routes/frontlineRoutes.js

const express = require('express');
const router = express.Router();
const frontlineController = require('../controllers/frontlineController');

// Middleware to check if a user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login');
};

// --- Public Routes ---
router.get('/login', frontlineController.getLoginPage);
router.post('/login', frontlineController.postLogin);
router.get('/logout', frontlineController.logoutUser);

// --- Protected Front Liner Routes ---
router.get('/', isAuthenticated, frontlineController.getOrderScreen);
router.get('/product/:id', isAuthenticated, frontlineController.getProductDetailPage);
router.get('/cart', isAuthenticated, frontlineController.getCartPage);
router.get('/sales', isAuthenticated, frontlineController.getSalesPage); 

// API route for creating an order
router.post('/orders', isAuthenticated, frontlineController.createOrder);

module.exports = router;