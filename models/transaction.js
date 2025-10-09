// Sales
const mongoose = require('mongoose');
const { Schema } = mongoose;

const transactionSchema = new Schema({
    customerName: {
        type: String,
        trim: true
    },
    items: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true 
        },
        sizeLabel: { 
            type: String,
            required: false 
        }
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Ready', 'Completed', 'Cancelled'],
        default: 'Pending'
    }
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;