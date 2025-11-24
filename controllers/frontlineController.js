// File: controllers/frontlineController.js

const User = require('../models/user');
const Product = require('../models/product');
const Transaction = require('../models/transaction');
const Category = require('../models/category');
const Size = require('../models/size');
const Price = require('../models/price');
const Branch = require('../models/branch');
const StaffApplication = require('../models/staffApplication');
const bcrypt = require('bcryptjs')
const getLoginPage = (req, res) => {
    if (req.session.user) {
        if (req.session.user.role === 'Super Admin') return res.redirect('/superadmin/dashboard');
        if (req.session.user.role === 'Admin') return res.redirect('/admin/dashboard');
        // Added: Redirect for Assistant Manager if already logged in
        if (req.session.user.role === 'Assistant Manager') return res.redirect('/assistant/registrations'); // Assuming this will be the route
        if (req.session.user.role === 'Cook') return res.redirect('/cook/dashboard');
        return res.redirect('/');
    }
    res.render('login',{message: req.query.message, messageType: req.query.type});
};

const postLogin = async (req, res) => {
    try {
        // Updated: Destructure 'username' from req.body, which now holds the contactNumber from the form
        const { username: contactNumber, password } = req.body;

        // Updated: Find user by contactNumber instead of username
        const user = await User.findOne({ contactNumber: contactNumber });
        if (!user) {
            // Updated: Error message refers to phone number
            return res.status(401).json({ message: "Invalid phone number or password." });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            // Updated: Error message refers to phone number
            return res.status(401).json({ message: "Invalid phone number or password." });
        }

        // Updated: Added contactNumber to the session
        req.session.user = {
            id: user._id,
            username: user.username, // Keep username for potential display needs
            contactNumber: user.contactNumber, // Store contact number in session
            role: user.role,
            branch: user.branch // Store branch ID in session
        };
        
        if(contactNumber == password){
            console.log("Same contact and password! change now!")
            return res.status(200).json({ success: true, redirectUrl: "/password/reset" })
        }


        let redirectUrl = '/'; // Default for Front Liner
        if (user.role === 'Super Admin') {
            redirectUrl = '/superadmin/dashboard';
        } else if (user.role === 'Admin') {
            redirectUrl = '/admin/dashboard';
        } else if (user.role === 'Cook') {
            redirectUrl = '/cook/dashboard';
        }
        // Added: Redirect logic for Assistant Manager
        else if (user.role === 'Assistant Manager') {
             redirectUrl = '/assistant/registrations'; // Set the specific route for Assistant Manager
        }

        return res.status(200).json({ success: true, redirectUrl: redirectUrl });

    } catch (error) {
        console.error('Login Error:', error);
        return res.status(500).json({ message: 'An internal server error occurred. Please try again later.' });
    }
};


const logoutUser = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Session destruction error:', err);
            return res.status(500).send('Could not log out.');
        }
        res.redirect('/login');
    });
};

const getStaffApplicationPage = async (req, res) => {
    try {
        const branches = await Branch.find({ status: 'Active' }).sort({ name: 1 });
        res.render('frontline/apply', {
            branches: branches,
            errors: null,
            input: {}
        });
    } catch (error) {
        console.error('Error fetching data for application page:', error);
        res.status(500).send('Server Error');
    }
};

const postStaffApplication = async (req, res) => {
    const {
        firstName, lastName, contactNumber,
        password, confirmPassword, positionApplied, preferredBranch
    } = req.body;

    if (password !== confirmPassword) {
        const branches = await Branch.find({ status: 'Active' }).sort({ name: 1 });
        return res.status(400).render('frontline/apply', {
            branches: branches,
            errors: ['Passwords do not match.'],
            input: req.body
        });
    }

    if (password.length < 8) {
         const branches = await Branch.find({ status: 'Active' }).sort({ name: 1 });
         return res.status(400).render('frontline/apply', {
            branches: branches,
            errors: ['Password must be at least 8 characters long.'],
            input: req.body
        });
    }

    try {
        const existingUser = await User.findOne({ contactNumber: contactNumber });
        if (existingUser) {
            throw { customError: 'This phone number is already registered.' };
        }

        const newApplication = new StaffApplication({
            firstName, lastName, contactNumber,
            password, positionApplied, preferredBranch
        });
        await newApplication.save();

        res.render('frontline/applySuccess', { contactNumber: contactNumber });

    } catch (error) {
        const branches = await Branch.find({ status: 'Active' }).sort({ name: 1 });
        let errors = [];

        if (error.customError) {
             errors.push(error.customError);
        } else if (error.code === 11000 && error.keyPattern && error.keyPattern.contactNumber) {
            errors.push('An application with this phone number already exists.');
        } else if (error.name === 'ValidationError') {
            for (let field in error.errors) {
                errors.push(error.errors[field].message);
            }
        } else {
            console.error('Unexpected error submitting application:', error);
            errors.push('An unexpected error occurred. Please try again.');
        }

        res.status(400).render('frontline/apply', {
            branches: branches,
            errors: errors,
            input: req.body
        });
    }
};


const getOrderScreen = async (req, res) => {
    if(req.session.user){
        if(req.session.user.role == "Admin"){return res.redirect('/admin/dashboard')}
        else if(req.session.user.role == "Cook"){return res.redirect('/cook/dashboard')}
        const user = await User.findOne({contactNumber: req.session.user.contactNumber})
        console.log("Logged user: ",user)
        if(await user.comparePassword(user.contactNumber)){
            return res.redirect('/password/reset')
        }
    }else{
        return res.redirect('/login')
    }
    try {
        const categoryFilter = req.query.category;
        const allCategories = await Category.find({});
        let productQuery = { branches: req.session.user.branch };

        if (categoryFilter) {
            const decodedCategoryName = decodeURIComponent(categoryFilter);
            const category = await Category.findOne({ name: decodedCategoryName });
            if (category) {
                productQuery.category = category._id;
            }
        }

        const products = await Product.find(productQuery).sort({ name: 1 }).populate('category', 'name');
        const readyOrdersCount = await Transaction.countDocuments({ status: 'Ready', branch: req.session.user.branch });

        res.render('frontline/index', {
            user: req.session.user,
            products: products,
            categories: allCategories,
            categoryFilter: categoryFilter || null,
            activePage: 'products',
            readyOrdersCount: readyOrdersCount
        });
    } catch (error) {
        console.error('Error fetching products for order screen:', error);
        res.status(500).send('Server Error');
    }
};

const getProductDetailPage = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId).populate('category', 'name');

        if (!product) {
            return res.status(404).send('Product not found');
        }

        const readyOrdersCount = await Transaction.countDocuments({ status: 'Ready', branch: req.session.user.branch });

        res.render('frontline/productDetail', {
            product: product,
            user: req.session.user,
            activePage: 'products',
            readyOrdersCount: readyOrdersCount
        });
    } catch (error) {
        console.error('Error fetching product detail:', error);
        res.status(500).send('Server Error');
    }
};

const getCartPage = async (req, res) => {
    const readyOrdersCount = await Transaction.countDocuments({ status: 'Ready', branch: req.session.user.branch });
    res.render('frontline/cart', {
        user: req.session.user,
        activePage: 'cart',
        readyOrdersCount: readyOrdersCount
    });
};

const getSalesPage = async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const todaysTransactions = await Transaction.find({
            branch: req.session.user.branch,
            createdAt: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ createdAt: -1 }).populate('createdBy', 'username').populate('items.productId', 'name');

        const completedTransactions = todaysTransactions.filter(t => t.status === 'Completed');
        const totalSales = completedTransactions.reduce((acc, transaction) => acc + transaction.totalAmount, 0);
        const totalOrders = todaysTransactions.length;
        const totalCompletedOrders = completedTransactions.length;
        const readyOrdersCount = await Transaction.countDocuments({ status: 'Ready', branch: req.session.user.branch });

        res.render('frontline/sales', {
            user: req.session.user,
            activePage: 'sales',
            transactions: todaysTransactions,
            totalSales: totalSales,
            totalOrders: totalOrders,
            totalCompletedOrders: totalCompletedOrders,
            readyOrdersCount: readyOrdersCount
        });
    } catch (error) {
        console.error('Error fetching today\'s sales:', error);
        res.status(500).send('Server Error');
    }
};

const createOrder = async (req, res) => {
    try {
        const { cart, customerName, paymentMethod, discountApplied, totalAmount } = req.body;

        if (!cart || cart.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty.' });
        }

        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const discountAmount = discountApplied ? subtotal * 0.20 : 0;
        const serverTotalAmount = subtotal - discountAmount;

        if (Math.abs(serverTotalAmount - totalAmount) > 0.01) {
            console.warn('Client-side total did not match server-side total. Using server total.');
        }

        const orderItems = cart.map(cartItem => {
            return {
                productId: cartItem.id,
                quantity: cartItem.quantity,
                price: cartItem.price,
                sizeLabel: cartItem.sizeLabel
            };
        });

        const newTransaction = new Transaction({
            customerName: customerName,
            items: orderItems,
            totalAmount: serverTotalAmount,
            paymentMethod: paymentMethod,
            discountApplied: discountApplied,
            discountAmount: discountAmount,
            createdBy: req.session.user.id,
            branch: req.session.user.branch
        });

        await newTransaction.save();

        const populatedTransaction = await Transaction.findById(newTransaction._id)
            .populate('items.productId', 'name');

        req.io.emit('newOrder', populatedTransaction);
        req.io.emit('superAdminNewOrder', { branchId: req.session.user.branch });

        res.status(201).json({
            success: true,
            message: 'Order placed successfully!',
            orderId: newTransaction._id
        });

    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ success: false, message: 'Server error while creating order.' });
    }
};

const completeOrder = async (req, res) => {
    try {
        const transactionId = req.params.id;
        const transaction = await Transaction.findById(transactionId);
        if (!transaction) return res.status(404).send('Transaction not found.');

        const oldStatus = transaction.status;
        await Transaction.findByIdAndUpdate(transactionId, { status: 'Completed' });

        req.io.emit('orderStatusUpdated', {
            orderId: transactionId,
            oldStatus: oldStatus,
            newStatus: 'Completed'
        });

        req.io.emit('superAdminNewOrder', { branchId: transaction.branch });

        res.redirect('/sales');
    } catch (error) {
        console.error('Error completing order:', error);
        res.status(500).send('Server Error');
    }
};

const cancelOrder = async (req, res) => {
    try {
        const transactionId = req.params.id;
        const transaction = await Transaction.findById(transactionId);
        if (!transaction) return res.status(404).send('Transaction not found.');

        const oldStatus = transaction.status;
        await Transaction.findByIdAndUpdate(transactionId, { status: 'Cancelled' });

        req.io.emit('orderStatusUpdated', {
            orderId: transactionId,
            oldStatus: oldStatus,
            newStatus: 'Cancelled'
        });

        req.io.emit('superAdminNewOrder', { branchId: transaction.branch });

        res.redirect('/sales');
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).send('Server Error');
    }
};

const getProfilePage = async (req, res) => {
    if(!req.session.user){
        return res.redirect('/')
    }
    try{
        const userId = req.params.id
        console.log("User to edit: ", userId)
        const userDetails = await User.findById(userId)
        if(!userDetails){
            return res.status(401).json({message: "User Not Found"})
        }
        return res.status(200).render('./frontline/profile', {user: userDetails, message: req.query.message, messageType: req.query.type})
    }catch(error){
        console.log("Error Loading Profile Page: ",error)
        return res.status(500).json({message: "Internal Server Error"})
    }
}

const postProfileUpdate = async (req, res) => {
    if(!req.session.user){
        return res.redirect('/login')
    }
    try{
        const {firstName, lastName, id, contactNumber} = req.body
        if(!firstName || !lastName || !contactNumber){
            return res.redirect(`/profile/${id}?message=${encodeURIComponent("Missing Required Fields")}&type=error`)
        }

        const isContactNumberExists = await User.findOne({contactNumber: contactNumber})
        if(isContactNumberExists && contactNumber != req.session.user.contactNumber){
            return res.redirect(`/profile/${id}?message=${encodeURIComponent("Contact Number Already Taken")}&type=error`)
        }

        const UpdatedUser = await User.findByIdAndUpdate(id,{firstName, lastName, contactNumber})
        if(!UpdatedUser){
            return res.redirect(`/profile/${id}?message=${encodeURIComponent("User Not Found")}&type=error`)
        }
        req.session.user = {
            id: UpdatedUser._id,
            contactNumber: UpdatedUser.contactNumber, // Store contact number in session
            role: UpdatedUser.role,
            branch: UpdatedUser.branch // Store branch ID in session
        };
        return res.status(200).redirect(`/profile/${id}?message=${encodeURIComponent("User Profile Updated Successfully")}&type=success`)
    }catch(error){
        console.log("Error Loading Profile Page: ",error)
        return res.status(500).json({message: "Internal Server Error"})
    }
}
const getResetPasswordPage = (req, res) => {
    if(!req.session.user){
        return res.redirect('/login')
    }
    try{
        res.render('./frontline/resetPassword',{user: req.session.user})
    }catch(error){
        console.log("Error Loading Reset Password Page: ",error)
        return res.status(500).json({message: "Internal Server Error"})
    }
}
const postResetPassword = async (req, res) => {
    if(!req.session.user){
        return res.redirect('/login')
    }
    try{
        const {contactNumber, password} = req.body
        if(!contactNumber || !password){
            return res.status(400).json({message: "Invalid user details"})
        }
        const resetUser = await User.findOne({contactNumber: contactNumber})
        if(!resetUser){
            return res.redirect(`/login?message=${encodeURIComponent('User not Found')}&type=error`)
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const updated = await User.findOneAndUpdate({contactNumber: contactNumber}, {password: hashedPassword})
        console.log("Password reset successful")
        req.session.destroy(err => {
            if (err) {
                console.error('Session destruction error:', err);
                return res.status(500).send('Could not log out.');
            }
        });
        if(!updated){
            return res.redirect(`/login?message=${encodeURIComponent('Error Reseting Password')}&type=error`)
        }
        return res.redirect(`/login?message=${encodeURIComponent('Password was Reset, Please log in again')}&type=success`)
    }catch(error){
        console.log("Error Reseting User Password ", error)
        return res.status(500).json({message: "Internal Server Error: Error Reseting Password"})
    }
}
module.exports = {
    getLoginPage,
    postLogin,
    logoutUser,
    getStaffApplicationPage,
    postStaffApplication,
    getOrderScreen,
    getProductDetailPage,
    getCartPage,
    getSalesPage,
    createOrder,
    completeOrder,
    cancelOrder,
    getProfilePage,
    postProfileUpdate,
    getResetPasswordPage,
    postResetPassword,
};