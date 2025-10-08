// File: routes/cookRoutes.js

const express = require('express');
const router = express.Router();
const cookController = require('../controllers/cookController');

// Middleware
const isCook = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'Cook') {
        return next();
    }
    
    res.redirect('/login'); 
};


router.use(isCook);


router.get('/dashboard', cookController.getDashboard);


router.post('/orders/:id/ready', cookController.markAsReady);

module.exports = router;