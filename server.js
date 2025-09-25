// .env
require('dotenv').config();

// dpndcs
const express = 'express';
const mongoose = require('mongoose');

//ROUTES ETO
const adminRoutes = require('./routes/adminRoutes');
const frontlineRoutes = require('./routes/frontlineRoutes');

// Initialization
const app = express();
const PORT = process.env.PORT || 3000;

// MDLWRE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// VIEW EJS
app.set('view engine', 'ejs');

//Use Routes
app.use('/admin', adminRoutes);
app.use('/', frontlineRoutes);


// MONGO
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('Successfully connected to MongoDB.');
      
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error('Database connection error:', err);
    });