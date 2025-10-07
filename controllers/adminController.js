// File: controllers/adminController.js

const Product = require('../models/product');
const Price = require('../models/price');
const User = require('../models/user');
const Category = require('../models/category');
const Transaction = require('../models/transaction'); 

const getDashboard = async (req, res) => {
    try {
        const products = await Product.find({}).sort({ createdAt: 'desc' });
        res.render('admin/products', {
            user: req.session.user,
            products: products,
            activePage: 'dashboard' 
        });
    } catch (error) {
        console.error('Error fetching products for dashboard:', error);
        res.status(500).send('Server error while fetching products.');
    }
};


const getAnalyticsPage = async (req, res) => {
    try {
        // --- Calculate Stats ---
        const totalOrders = await Transaction.countDocuments();
        
        const salesData = await Transaction.aggregate([
            { $group: { _id: null, totalSales: { $sum: '$totalAmount' } } }
        ]);
        const totalSales = salesData.length > 0 ? salesData[0].totalSales : 0;

        // --- Calculate Best Sellers ---
        const bestSellers = await Transaction.aggregate([
            // Deconstruct the items array
            { $unwind: '$items' },
            // Group by product, summing quantity and revenue
            { 
                $group: { 
                    _id: '$items.productId',
                    totalQuantity: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
                } 
            },
            // Sort by quantity sold
            { $sort: { totalQuantity: -1 } },
            // Limit to top 5
            { $limit: 5 },
            // Look up product details (like name)
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
         
            { $unwind: '$productDetails' }
        ]);

        // --- Placeholder Chart Data (for now) ---
        const salesTrendData = {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            data: [120, 190, 300, 500, 200, 350, 400]
        };
        const topProductsData = {
            labels: bestSellers.map(p => p.productDetails.name),
            data: bestSellers.map(p => p.totalQuantity)
        };

        res.render('admin/dashboard', { 
            user: req.session.user,
            activePage: 'analytics',
        
            totalSales,
            totalOrders,
            bestSellers,
    
            salesTrendData,
            topProductsData
        });

    } catch (error) {
        console.error('Error fetching analytics data:', error);
        res.status(500).send('Server error');
    }
};

const getProducts = async (req, res) => {
    try {
        const products = await Product.find({}).sort({ createdAt: 'desc' });
        res.render('admin/products', {
            user: req.session.user,
            products: products,
            activePage: 'products'
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send('Server error while fetching products.');
    }
};

// @desc    Show the page for adding a new product
// @route   GET /admin/products/add
// @access  Private (Admin Only)
const getAddProductPage = async (req, res) => {
    const categories = await Category.find()
    res.render('admin/addProduct', {
        user: req.session.user, categories: categories
    });
};


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
            product: product,
            activePage: 'products'
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
        res.render('admin/users',{user: req.session.user, users: users, activePage: 'users'})
    }catch(error){
        console.error(error)
        res.status(500).json({message: "Error fetching Users Page", type: "error"})
    }
}

const getAddUserPage = async (req, res) => {
    try{
        res.render('admin/addUser',{user:req.session.user, activePage: 'users'})
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
        res.redirect('/admin/users');
    }catch(error){
        console.error(error)
        return res.status(500).send("Error creating user.")
    }
}

const getUserEditPage = async (req, res) => {
    try{
        const id = req.params.id
        const user = await User.findById(id)
        if(!user){
            return res.status(400).json({message: "User not found", type: "error"})
        }
        res.render('admin/editUser', {user: req.session.user, user_details: user, activePage: 'users'})
    }catch(error){
        console.error(error)
        return res.status(500).json({message: "Error getting edit user page", type:"error"})
    }
}

const postUserEdit = async (req, res)=>{
    try{
        const id = req.params.id
        const {username, role} = req.body
        if(!username || !role){
            res.return(400).json({message: "Missing Field, please enter required Fields", type: "error"})
        }
        const updatedUser = await User.findOneAndUpdate({ _id: id }, {username:username, role:role})
        if(!updatedUser){
            return res.status(400).json({message:"Error Updating user: User Not Found", type: "error"})
        }
        console.log("User Updated")
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
        console.log("User Deleted Successfully")
        res.redirect('/admin/users');
    }catch(error){
        console.error(error)
        return res.status(500).json({message: "Error deleting user", type: "error"})
    }
}

const getCategories = async (req, res) => {
    try{
        const categories = await Category.find()
        res.render('./admin/categories',{user: req.session.user, categories: categories})
    }catch(error){
        console.log("Error getting categories page: ",error)
        res.status(500).json({message: "Error Getting Categories", type: "error"})
    }
}

const getAddCategoryPage = async (req, res) => {
    try{
        res.render('./admin/addCategory',{user: req.session.user})
    }catch(error){
        console.log("Error getting add category page: ",error)
        res.status(500).json({message: "Error Getting Add Category Page", type: "error"})
    }
}

const getEditCategoryPage = async (req, res) => {
    try{
        const id = req.params.id
        const category_details = await Category.findById(id)
        res.render('./admin/editCategory',{user: req.session.user, category_details: category_details})
    }catch(error){
        console.log("Error getting edit category page: ",error)
        res.status(500).json({message: "Error Getting Edit Category Page", type: "error"})
    }
}

const postAddCategory = async (req, res) => {
    try{
        const {name} = req.body
        const newCategory = await Category.create({name})
        if(!newCategory){
            res.status(500).json({message: "Error Creating Category"})
        }
        console.log("Added Category")
        res.status(2000).redirect('/admin/categories')
    }catch(error){
        console.log("Error Creating Category",error)
        res.status(500).json({message: "Error Adding Category", type: "error"})
    }
}

const postEditCategory = async (req, res) => {
    try{
        const id = req.params.id
        const {name} = req.body
        const updatedCategory = await Category.findByIdAndUpdate(id, {name})
        if(!updatedCategory){
            res.status(500).json({message: "Error Updating Category"})
        }
        res.status(200).redirect('/admin/categories')
    }catch(error){
        console.log("Error Editing Category: ",error)
        res.status(500).json({message: "Error Editing Category", type: "error"})
    }
}

const postDeletedCategory = async (req, res) => {
    try{
        const id = req.params.id
        const deletedCategory = await Category.findByIdAndDelete(id)
        if(!deletedCategory){
            res.status(500).json({message: "Error Deleting Category"})
        }
        res.status(200).redirect('/admin/categories')
    }catch(error){
        console.log("Error Deleting Category: ",error)
        res.status(500).json({message: "Error Deleting Category", type: "error"})
    }
}

module.exports = {
    getDashboard,
    getAnalyticsPage,
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
    postUserDelete,
    getCategories,
    getAddCategoryPage,
    getEditCategoryPage,
    postAddCategory,
    postEditCategory,
    postDeletedCategory,
};