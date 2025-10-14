// File: models/branch.js

const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Branch name is required.'],
        trim: true,
        unique: true
    },
    location: {
        type: String,
        required: [true, 'Branch location is required.'],
        trim: true
    },
    contact: {
        type: String,
        required: false,
        trim: true
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    }
}, { timestamps: true });

const Branch = mongoose.model('Branch', branchSchema);

module.exports = Branch;