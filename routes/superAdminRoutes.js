// File: routes/superAdminRoutes.js

const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminController');

// Middleware to ensure the user is a Super Admin
const isSuperAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'Super Admin') {
        return next();
    }
    if (req.session.user) {
        if (req.session.user.role === 'Admin') return res.redirect('/admin/dashboard');
        if (req.session.user.role === 'Cook') return res.redirect('/cook/dashboard');
        return res.redirect('/');
    }
    res.redirect('/login'); 
};

router.use(isSuperAdmin);

// Super Admin Dashboard
router.get('/dashboard', superAdminController.getDashboardPage);

// Branch Management
router.get('/branches', superAdminController.getBranchesPage);
router.get('/branches/add', superAdminController.getAddBranchPage);
router.post('/branches/add', superAdminController.postAddBranch);
router.get('/branches/edit/:id', superAdminController.getEditBranchPage);
router.post('/branches/edit/:id', superAdminController.postEditBranch);
router.post('/branches/delete/:id', superAdminController.postDeleteBranch);

// Product Management
router.get('/products', superAdminController.getProductsPage);
router.get('/products/add', superAdminController.getAddProductPage);
router.post('/products/add', superAdminController.postAddProduct);
router.get('/products/edit/:id', superAdminController.getEditProductPage);
router.post('/products/update/:id', superAdminController.postUpdateProduct);
router.post('/products/delete/:id', superAdminController.postDeleteProduct);

// User Management
router.get('/users', superAdminController.getUsersPage);
router.get('/users/add', superAdminController.getAddUserPage);
router.post('/users/add', superAdminController.postAddUser);
router.get('/users/edit/:id', superAdminController.getEditUserPage);
router.post('/users/edit/:id', superAdminController.postUpdateUser);
router.post('/users/delete/:id', superAdminController.postDeleteUser);

// Analytics 
router.get('/analytics', superAdminController.getAnalyticsPage);


module.exports = router;