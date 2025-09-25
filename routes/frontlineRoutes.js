// File: routes/frontlineRoutes.js

const express = require('express');
const router = express.Router();
const frontlineController = require('../controllers/frontlineController');

// --- meddleware ---

const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login');
};

// --- Public Routes  ETO---
router.get('/login', frontlineController.getLoginPage);
router.post('/login', frontlineController.postLogin);
router.get('/logout', frontlineController.logoutUser);

// --- Protected Front Liner Routes ---

router.get('/', isAuthenticated, frontlineController.getOrderScreen);



module.exports = router;