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
    price: {
        type: Number,
        required: [true, 'Product price is required.'],
        min: [0, 'Price cannot be negative.']
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