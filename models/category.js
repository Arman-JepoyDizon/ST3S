const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema(
    //pwede pa ata lagyan ng image???
  {
    name: { type: String, required: true, trim: true }
  },
  {
    timestamps: true,
  }
);

const Category = mongoose.model('Category', CategorySchema);

module.exports = Category
