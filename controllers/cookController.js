// File: controllers/cookController.js

const Transaction = require('../models/transaction');

const getDashboard = async (req, res) => {
    try {
        // Find all transactions that are still pending for the cook's branch
        const pendingOrders = await Transaction.find({ status: 'Pending', branch: req.session.user.branch })
            .sort({ createdAt: 1 }) // Show the oldest orders first (First-In, First-Out)
            .populate('items.productId', 'name'); 

        res.render('cook/dashboard', {
            user: req.session.user,
            orders: pendingOrders
        });
    } catch (error) {
        console.error('Error fetching orders for cook dashboard:', error);
        res.status(500).send('Server Error');
    }
};


const markAsReady = async (req, res) => {
    try {
        const transactionId = req.params.id;
        const transaction = await Transaction.findById(transactionId);
        if (!transaction) return res.status(404).send('Transaction not found.');

        const oldStatus = transaction.status;

        await Transaction.findByIdAndUpdate(transactionId, { status: 'Ready' });

        req.io.emit('orderStatusUpdated', { 
            orderId: transactionId, 
            oldStatus: oldStatus,
            newStatus: 'Ready' 
        });

        // Added: Emit event for analytics update
        req.io.emit('superAdminNewOrder', { branchId: transaction.branch });

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