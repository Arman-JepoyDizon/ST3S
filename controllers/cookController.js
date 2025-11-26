const Transaction = require('../models/transaction');

exports.getDashboard = async (req, res) => {
    try {
        // Get orders that are Pending or Ready for the cook's branch
        const orders = await Transaction.find({
            branch: req.session.user.branch,
            status: { $in: ['Pending', 'Ready'] }
        })
        .populate('items.productId')
        .sort({ createdAt: 1 }); // Oldest first

        res.render('cook/dashboard', { 
            user: req.session.user,
            orders
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};

exports.markAsReady = async (req, res) => {
    try {
        await Transaction.findByIdAndUpdate(req.params.id, { status: 'Ready' });
        
        // Emit socket event
        req.io.emit('orderStatusUpdated', { 
            orderId: req.params.id,
            oldStatus: 'Pending',
            newStatus: 'Ready'
        });
        
        res.redirect('/cook/dashboard');
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};

// Added: Cancel Order Function
exports.cancelOrder = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);
        if(transaction) {
            const oldStatus = transaction.status;
            transaction.status = 'Cancelled';
            await transaction.save();

            // Emit socket event so Admin/Frontline sees the update immediately
            req.io.emit('orderStatusUpdated', { 
                orderId: req.params.id,
                oldStatus: oldStatus,
                newStatus: 'Cancelled'
            });
        }
        
        res.redirect('/cook/dashboard');
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};