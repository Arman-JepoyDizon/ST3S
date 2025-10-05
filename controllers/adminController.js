// File: controllers/adminController.js

const Product = require('../models/product');
const Price = require('../models/price');
const User = require('../models/user');
const { resolveInclude } = require('ejs');

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
        const newProduct = await Product.create({ name, description, price, category, imageUrl });
        const newProductPrice = await Price.create({productId: newProduct._id, price: price})
        if(!newProductPrice){
            return res.status(500).json({message: "Error Creating Price", type: "error"})
        }
        if(!newProduct){
            return res.status(500).json({message: "Error Creating Product", type: "error"})
        }
        return res.redirect('/admin/products');
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
        const productId = req.params.id
        const { name, description, price, category, imageUrl } = req.body;
        const product = await Product.findById(productId);
        if(!product){
            return res.status(400).json({message: "Product Not Found", type: "error"})
        }

        if (product.price != price){
            await Price.create({productId: productId, price: price})
        }
        await Product.findByIdAndUpdate( productId, {name, description, price, category, imageUrl})

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

const getUserPage = async (req, res) => {
    try{
        const users = await User.find({}).sort({createdAt: 'desc'})
        res.render('admin/users',{user: req.session.user, users: users})
    }catch(error){
        console.error(error)
        res.status(500).json({message: "Error fetching Users Page", type: "error"})
    }
}

const getAddUserPage = async (req, res) => {
    try{
        // FIXED: The path now correctly points to the 'addUser' view in the 'admin' folder
        res.render('admin/addUser',{user:req.session.user})
    }catch(error){
        console.error(error)
        res.status(500).json({message: "Error Getting Add User Page", type: "error"})
    }
}

const postAddUser = async (req, res) => {
    try{
        const {username, password, passwordRepeat, role} = req.body
        if(password != passwordRepeat){
            return res.status(400).json({message: "Passwords do not match", type: "error"})
        }
        const newUser = await User.create({username: username, role: role, password: password})
        if(!newUser){
            return res.status(500).json({message: "Error Creating User", type: "error"})
        }
        // For now, let's redirect on success for a better user experience with standard forms
        res.redirect('/admin/users');
    }catch(error){
        console.error(error)
        // A simple error page/message might be better for the user
        return res.status(500).send("Error creating user. The username might already exist.")
    }
}

const getUserEditPage = async (req, res) => {
    try{
        const id = req.params.id
        const user = await User.findById(id)
        if(!user){
            return res.status(400).json({message: "User not found", type: "error"})
        }
        res.render('admin/editUser', {user: req.session.user, user_details: user})
    }catch(error){
        console.error(error)
        return res.status(500).json({message: "Error getting edit user page", type:"error"})
    }
}

const postUserEdit = async (req, res)=>{
    try{
        const id = req.params.id
        const {username, role} = req.body
        const updatedUser = await User.findOneAndUpdate({ _id: id }, {username:username, role:role})
        if(!updatedUser){
            return res.status(400).json({message:"Error Updating user: User Not Found", type: "error"})
        }
        res.redirect('/admin/users');
    }catch(error){
        console.error(error)
        return res.status(500).json({message: "Error Updating User", type: "error"})
    }
}

const postUserDelete = async (req, res) => {
    try{
        const id = req.params.id
        const deletedUser = await User.findByIdAndDelete(id)
        if(!deletedUser){
            return res.status(400).json({message: "Error deleting user: User not found", type: "error"})
        }
        res.redirect('/admin/users');
    }catch(error){
        console.error(error)
        return res.status(500).json({message: "Error deleting user", type: "error"})
    }
}
module.exports = {
    getDashboard,
    getProducts,
    getAddProductPage,
    postAddProduct,
    getEditProductPage,
    postUpdateProduct,
    deleteProduct,
    getUserPage,
    getAddUserPage,
    postAddUser,
    getUserEditPage,
    postUserEdit,
    postUserDelete
};