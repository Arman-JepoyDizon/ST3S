const mongoose = require('mongoose');

const sizeSchema = new mongoose.Schema({
    productId: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: "Product",
        required: true,
    },
    label: {
        type: String,
        required: [true],
        trim: true,
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active',
    },
})

const Size = mongoose.model('Size', sizeSchema);
module.exports = Size;