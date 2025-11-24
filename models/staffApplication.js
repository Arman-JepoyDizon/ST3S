// File: models/staffApplication.js
// Added: New model to store staff application data.

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Needed for password hashing

const staffApplicationSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'First name is required.'],
        trim: true,
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required.'],
        trim: true,
    },
    contactNumber: {
        type: String,
        required: [true, 'Contact number is required.'],
        unique: true, // Ensure phone number is unique among applications
        trim: true,
        validate: {
            validator: function(v) {
                return /^\+63\d{10}$/.test(v); // Validate +63 format
            },
            message: props => `${props.value} is not a valid contact number format! Must start with +63 followed by 10 digits.`
        }
    },
    password: {
        type: String,
        required: [true, 'Password is required.'],
        minlength: [8, 'Password must be at least 8 characters long.'],
        // Note: Password complexity rules enforced on the User model upon creation.
        // We store the hash here directly.
    },
    positionApplied: {
        type: String,
        required: [true, 'Position applied for is required.'],
        enum: ['Front Liner', 'Cook', 'Admin'], // Define applicable roles
    },
    preferredBranch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: [true, 'Preferred branch is required.'],
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending',
    },
    // Optional: Fields to store who reviewed the application and when
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
    },
    reviewedAt: {
        type: Date,
        required: false,
    }
}, { timestamps: true }); // Adds createdAt and updatedAt automatically

// Pre-save hook to hash password BEFORE saving the application
staffApplicationSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
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

const StaffApplication = mongoose.model('StaffApplication', staffApplicationSchema);

module.exports = StaffApplication;