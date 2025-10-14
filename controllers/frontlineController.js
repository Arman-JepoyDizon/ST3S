const User = require('../models/user');
const Product = require('../models/product');
const Transaction = require('../models/transaction');
const Category = require('../models/category');
const Size = require('../models/size');
const Price = require('../models/price');

const getLoginPage = (req, res) => {
    if (req.session.user) {
        if (req.session.user.role === 'Super Admin') return res.redirect('/superadmin/dashboard');
        if (req.session.user.role === 'Admin') return res.redirect('/admin/dashboard');
        if (req.session.user.role === 'Cook') return res.redirect('/cook/dashboard');
        return res.redirect('/');
    }
    res.render('login');
};

const postLogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: "Invalid username or password." });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid username or password." });
        }

        req.session.user = {
            id: user._id,
            username: user.username,
            role: user.role,
            branch: user.branch // Store branch ID in session
        };

        let redirectUrl = '/';
        if (user.role === 'Super Admin') {
            redirectUrl = '/superadmin/dashboard';
        } else if (user.role === 'Admin') {
            redirectUrl = '/admin/dashboard';
        } else if (user.role === 'Cook') {
            redirectUrl = '/cook/dashboard';
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

const getOrderScreen = async (req, res) => {
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

        const sizes = await Size.find({ productId: productId, status: 'Active' });
        const prices = await Price.find({ productId: productId, status: 'Active' });
        const readyOrdersCount = await Transaction.countDocuments({ status: 'Ready', branch: req.session.user.branch });

        res.render('frontline/productDetail', {
            product: product,
            sizes: sizes,
            prices: prices,
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
            branch: req.session.user.branch // Add branch ID to the transaction
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

module.exports = {
    getLoginPage,
    postLogin,
    logoutUser,
    getOrderScreen,
    getProductDetailPage,
    getCartPage,
    getSalesPage,
    createOrder,
    completeOrder,
    cancelOrder
};