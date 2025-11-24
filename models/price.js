const mongoose = require('mongoose');
const { Schema } = mongoose;

const priceSchema = new Schema({
    size: {
        type: String,
        required: false,
    },
    price: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    },
    effectiveDate: {
        type: Date,
        default: Date.now
    }
});

const Price = mongoose.model('Price', priceSchema);

module.exports = Price;