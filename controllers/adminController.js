// File: controllers/adminController.js

const Product = require('../models/product');

// @desc    Show the admin dashboard page
// @route   GET /admin/dashboard
// @access  Private (Admin Only)
const getDashboard = (req, res) => {
    res.render('admin/dashboard', { user: req.session.user });
};

// @desc    Show product management page with all products
// @route   GET /admin/products
// @access  Private (Admin Only)
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

const getEditProductPage = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).send('Product not found.');
        }
        res.render('admin/editProduct', {
            user: req.session.user,
            product: product
        });
    } catch (error) {
        console.error('Error fetching product for edit:', error);
        res.status(500).send('Server error.');
    }
};


const postUpdateProduct = async (req, res) => {
    try {
        const { name, description, price, category, imageUrl } = req.body;
        await Product.findByIdAndUpdate(req.params.id, {
            name,
            description,
            price,
            category,
            imageUrl
        });
        res.redirect('/admin/products');
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).send('Server error while updating product.');
    }
};

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
    getEditProductPage,
    postUpdateProduct,
    deleteProduct
};