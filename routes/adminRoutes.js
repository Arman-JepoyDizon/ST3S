// File: routes/adminRoutes.js

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// --- Middleware for Admin Role Check ---

const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'Admin') {
        return next(); // If user is an Admin, proceed to the requested route.
    }
    // If user is not logged in or is not an Admin, deny access.
    res.redirect('/login'); 
};

// Apply the `isAdmin` middleware to ALL routes defined in this file.
router.use(isAdmin);

// --- Admin Routes ---

// Admin Dashboard Route
router.get('/dashboard', adminController.getDashboard);

module.exports = router;