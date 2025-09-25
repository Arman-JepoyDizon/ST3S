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


router.get('/dashboard', adminController.getDashboard);


router.get('/products', adminController.getProducts); 


module.exports = router;