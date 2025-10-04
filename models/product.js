// File: models/product.js

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required.'],
        trim: true,
        unique: true
    },
    description: {
        type: String,
        trim: true
    },
    category: {
        type: String,
        required: [true, 'Product category is required.'],
        trim: true
    },
    imageUrl: {
        type: String,
        required: false 
    }
}, { 

    timestamps: true 
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;