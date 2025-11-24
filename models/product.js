const mongoose = require('mongoose');
const priceSchema = require("./price")

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required.'],
        trim: true,
        unique: true
    },
    price: [{
        size: {
            type: String,
            required: false,
            unique: true,
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
    }],
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
    }],
    status:{
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active',
    }
}, { 
    timestamps: true 
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;