const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema(
    //pwede pa ata lagyan ng image???
  {
    name: { 
        type: String, 
        required: true, 
        trim: true, 
        minlength: [3, 'category must be at least 3 characters long.'],
        maxlength: [50, 'category cannot be more than 50 characters long.'] 
    }
  },
  {
    timestamps: true,
  }
);

const Category = mongoose.model('Category', CategorySchema);

module.exports = Category