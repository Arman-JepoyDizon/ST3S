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
})

const Size = mongoose.model('Size', sizeSchema);
module.exports = Size;