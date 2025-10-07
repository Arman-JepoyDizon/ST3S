// File: controllers/cookController.js

const Transaction = require('../models/transaction');


const getDashboard = async (req, res) => {
    try {
        // Find all transactions that are still pending
        const pendingOrders = await Transaction.find({ status: 'Pending' })
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
        const oldStatus = transaction.status;

        await Transaction.findByIdAndUpdate(transactionId, { status: 'Ready' });

        req.io.emit('orderStatusUpdated', { 
            orderId: transactionId, 
            oldStatus: oldStatus,
            newStatus: 'Ready' 
        });

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