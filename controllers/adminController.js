// File: controllers/adminController.js

const Product = require('../models/product');


const getDashboard = (req, res) => {
    res.render('admin/dashboard', { user: req.session.user });
};


const getProducts = async (req, res) => {
    try {
        // Fetch all products from the database, sorting by the newest ones first
        const products = await Product.find({}).sort({ createdAt: 'desc' });
        
        // Render the product page and pass the list of products to it
        res.render('admin/products', {
            user: req.session.user,
            products: products 
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send('Server error while fetching products.');
    }
};

module.exports = {
    getDashboard,
    getProducts
};