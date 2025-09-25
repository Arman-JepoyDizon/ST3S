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


const getAddProductPage = (req, res) => {
    res.render('admin/addProduct', {
        user: req.session.user
    });
};


const postAddProduct = async (req, res) => {
    try {
        // Destructure the data from the form body
        const { name, description, price, category, imageUrl } = req.body;
        
        // Create a new product instance
        const newProduct = new Product({
            name,
            description,
            price,
            category,
            imageUrl
        });

        // Save the new product to the database
        await newProduct.save();

        // Redirect back to the main products page
        res.redirect('/admin/products');
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).send('Server error while adding product.');
    }
};

module.exports = {
    getDashboard,
    getProducts,
    getAddProductPage,
    postAddProduct
};