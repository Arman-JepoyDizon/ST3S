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

// Added: Routes for the public staff application form
router.get('/apply', frontlineController.getStaffApplicationPage); 
router.post('/apply', frontlineController.postStaffApplication); 

// --- Protected Front Liner Page Routes ---
router.get('/', isAuthenticated, frontlineController.getOrderScreen);
router.get('/product/:id', isAuthenticated, frontlineController.getProductDetailPage);
router.get('/cart', isAuthenticated, frontlineController.getCartPage);
router.get('/sales', isAuthenticated, frontlineController.getSalesPage);

// --- Protected Front Liner API/Action Routes ---
router.post('/orders', isAuthenticated, frontlineController.createOrder);
router.post('/orders/:id/complete', isAuthenticated, frontlineController.completeOrder);
router.post('/orders/:id/cancel', isAuthenticated, frontlineController.cancelOrder);

module.exports = router;