// File: models/user.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required.'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters long.'],
        maxlength: [50, 'Username cannot be more than 50 characters long.']
    },
    contactNumber: {
        type: String,
        required: [true, 'Contact number is required.'],
        trim: true,
        validate: {
            validator: function(v) {
                // Validates +63 followed by 10 digits
                return /^\+63\d{10}$/.test(v);
            },
            message: props => `${props.value} is not a valid contact number format! Must be +63 followed by 10 digits.`
        }
    },
    password: {
        type: String,
        required: [true, 'Password is required.'],
        minlength: [8, 'Password must be at least 8 characters long.'],
        match: [
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
            'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.'
        ]
    },
    role: {
        type: String,
        enum: ['Super Admin', 'Admin', 'Front Liner', 'Cook'],
        default: 'Front Liner'
    },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: [
            function() { return this.role !== 'Super Admin'; },
            'A branch assignment is required for this user role.'
        ]
    }
}, { timestamps: true });

// Pre-save hook to hash password
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

userSchema.methods.comparePassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;