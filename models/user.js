// File: models/user.js
// Updated: Added firstName and lastName fields.

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    // Added: firstName field
    firstName: {
        type: String,
        required: [true, 'First name is required.'],
        trim: true,
    },
    // Added: lastName field
    lastName: {
        type: String,
        required: [true, 'Last name is required.'],
        trim: true,
    },
    
    /* // Kept username for internal use/fallback
    username: {
        type: String,
        required: [true, 'Username is required.'],
        trim: true,
        minlength: [3, 'Username must be at least 3 characters long.'],
        maxlength: [50, 'Username cannot be more than 50 characters long.']
        // unique: false // Keep non-unique if desired
    }, */

    contactNumber: {
        type: String,
        required: [true, 'Contact number is required.'],
        unique: true, // Primary login identifier
        trim: true,
        validate: {
            validator: function(v) { return /^\+63\d{10}$/.test(v); },
            message: props => `${props.value} is not a valid contact number format! Must be +63 followed by 10 digits.`
        }
    },
    password: {
        type: String,
        required: [true, 'Password is required.'],
        minlength: [8, 'Password must be at least 8 characters long.'],
    },
    role: {
        type: String,
        enum: ['Super Admin', 'Admin', 'Assistant Manager', 'Front Liner', 'Cook'],
        default: 'Front Liner'
    },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: [ function() { return this.role !== 'Super Admin'; }, 'A branch assignment is required for this user role.' ]
    }
}, { timestamps: true });

// comparePassword method (remains the same)
userSchema.methods.comparePassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;