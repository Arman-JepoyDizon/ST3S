// File: controllers/adminController.js

const Product = require('../models/product');

const getDashboard = (req, res) => {
    res.render('admin/dashboard', { user: req.session.user });
};

const getProducts = async (req, res) => {
    try {
        const products = await Product.find({}).sort({ createdAt: 'desc' });
        res.render('admin/products', {
            user: req.session.user,
            products: products 
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send('Server error while fetching products.');
    }
};

// @desc    Show the page for adding a new product
// @route   GET /admin/products/add
// @access  Private (Admin Only)
const getAddProductPage = (req, res) => {
    res.render('admin/addProduct', {
        user: req.session.user
    });
};

// @desc    Process the form submission for a new product
// @route   POST /admin/products/add
// @access  Private (Admin Only)
const postAddProduct = async (req, res) => {
    try {
        const { name, description, price, category, imageUrl } = req.body;
        const newProduct = new Product({ name, description, price, category, imageUrl });
        await newProduct.save();
        res.redirect('/admin/products');
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).send('Server error while adding product.');
    }
};

// @desc    Delete a product by its ID
// @route   POST /admin/products/delete/:id
// @access  Private (Admin Only)
const deleteProduct = async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.redirect('/admin/products');
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).send('Server error while deleting product.');
    }
};

module.exports = {
    getDashboard,
    getProducts,
    getAddProductPage,
    postAddProduct,
    deleteProduct
};