// File: routes/adminRoutes.js

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'Admin') {
        return next();
    }
    res.redirect('/login'); 
};

router.use(isAdmin);



// Admin Dashboard Route
router.get('/dashboard', adminController.getDashboard);

// Product Management Routes
router.get('/products', adminController.getProducts);
router.get('/products/add', adminController.getAddProductPage);
router.post('/products/add', adminController.postAddProduct);
router.get('/products/edit/:id', adminController.getEditProductPage); 
router.post('/products/update/:id', adminController.postUpdateProduct); 
router.post('/products/delete/:id', adminController.deleteProduct);
//User Management Routes
router.get('/users', adminController.getUserPage);
router.get('/users/add', adminController.getAddUserPage);
router.post('/users/add', adminController.getAddUserPage);
router.get('/users/edit/:id', adminController.getAddUserPage);
router.post('/users/edit/:id', adminController.getAddUserPage);
router.post('/users/delete', adminController.getAddUserPage);

module.exports = router;