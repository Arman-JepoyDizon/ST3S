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

// Admin Dashboard & Analytics Routes
router.get('/dashboard', adminController.getAnalyticsPage);
router.get('/orders', adminController.getOrdersPage);
router.get('/orders/count', adminController.getOrdersCount);
router.get('/orders/export', adminController.exportOrders);
router.get('/orders/renderList', adminController.renderOrdersList);
router.post('/orders/:id/status', adminController.updateOrderStatus);
router.get('/orders/data', adminController.getOrdersData); 

// Product Management Routes
router.get('/products', adminController.getProducts);
router.get('/products/add', adminController.getAddProductPage);
router.post('/products/add', adminController.postAddProduct);
router.get('/products/edit/:id', adminController.getEditProductPage);
router.post('/products/update/:id', adminController.postUpdateProduct);
router.post('/products/delete/:id', adminController.deleteProduct);
// Added: Route for deleting product sizes (if not already present from previous steps)
router.post('/products/size/:id/delete', adminController.deleteSize);


// User Management Routes
router.get('/users', adminController.getUserPage);
router.get('/users/add', adminController.getAddUserPage);
router.post('/users/add', adminController.postAddUser);
router.get('/users/edit/:id', adminController.getUserEditPage);
router.post('/users/edit/:id', adminController.postUserEdit);
router.post('/users/delete/:id', adminController.postUserDelete); // Ensure delete route exists if needed

//Category Management Routes
router.get('/categories', adminController.getCategories)
router.get('/categories/add', adminController.getAddCategoryPage)
router.get('/categories/edit/:id', adminController.getEditCategoryPage)
router.post('/categories/edit/:id', adminController.postEditCategory)
router.post('/categories/add', adminController.postAddCategory)
router.post('/categories/delete/:id', adminController.postDeletedCategory)

module.exports = router;