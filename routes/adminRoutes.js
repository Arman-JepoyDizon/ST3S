const express = require('express');
const router = express.Router();

// Dto admin controller
// const adminController = require('../controllers/adminController');

// Admin Dashboard Route
router.get('/dashboard', /* adminController.getDashboard */);

// Product Management Routes
router.get('/products', /* adminController.getProducts */);
router.post('/products/add', /* adminController.addProduct */);
router.post('/products/update/:id', /* adminController.updateProduct */);
router.post('/products/remove/:id', /* adminController.removeProduct */);

// User Management Routes
router.get('/users', /* adminController.getUsers */);
router.post('/users/add', /* adminController.addUser */);

module.exports = router;