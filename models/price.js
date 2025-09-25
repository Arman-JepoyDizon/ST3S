const mongoose = require('mongoose');
const { Schema } = mongoose;

const priceSchema = new Schema({
    productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    effectiveDate: {
        type: Date,
        default: Date.now
    }
});

const Price = mongoose.model('Price', priceSchema);

module.exports = Price;