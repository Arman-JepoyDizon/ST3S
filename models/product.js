// File: models/product.js

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required.'],
        trim: true,
        unique: true
    },
    price: {
        type: Number,
        required: [true, 'Product price is required.'],
        min: [0, 'Price cannot be negative.']
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true,
    },
    imageUrl: {
        type: String,
        required: false 
    },
    branches: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: [true, 'Product must be assigned to at least one branch.']
    }]
}, { 
    timestamps: true 
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;