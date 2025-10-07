// File: routes/cookRoutes.js

const express = require('express');
const router = express.Router();
const cookController = require('../controllers/cookController');

// Middleware to ensure the user is logged in and has the 'Cook' role
const isCook = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'Cook') {
        return next();
    }
    // Redirect to login if not a cook
    res.redirect('/login'); 
};

// Apply the 'isCook' middleware to all routes in this file
router.use(isCook);


router.get('/dashboard', cookController.getDashboard);


router.post('/orders/:id/ready', cookController.markAsReady);

module.exports = router;