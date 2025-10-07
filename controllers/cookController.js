// File: controllers/cookController.js

const Transaction = require('../models/transaction');

/**
 * @desc    Get the cook's dashboard with all pending orders
 * @route   GET /cook/dashboard
 * @access  Private (Cook Only)
 */
const getDashboard = async (req, res) => {
    try {
        // Find all transactions that are still pending
        const pendingOrders = await Transaction.find({ status: 'Pending' })
            .sort({ createdAt: 1 }) // Show the oldest orders first (First-In, First-Out)
            .populate('items.productId', 'name'); // Get the name of each product in the order

        res.render('cook/dashboard', {
            user: req.session.user,
            orders: pendingOrders
        });
    } catch (error) {
        console.error('Error fetching orders for cook dashboard:', error);
        res.status(500).send('Server Error');
    }
};

/**
 * @desc    Update an order's status to 'Ready'
 * @route   POST /cook/orders/:id/ready
 * @access  Private (Cook Only)
 */
const markAsReady = async (req, res) => {
    try {
        const transactionId = req.params.id;
        await Transaction.findByIdAndUpdate(transactionId, { status: 'Ready' });
        // Redirect back to the cook's dashboard to refresh the list
        res.redirect('/cook/dashboard');
    } catch (error) {
        console.error('Error marking order as ready:', error);
        res.status(500).send('Server Error');
    }
};

module.exports = {
    getDashboard,
    markAsReady
};