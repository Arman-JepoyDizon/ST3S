// File: server.js

// Load environment variables from .env file
require('dotenv').config();

// dpndcs
const express = 'express';
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');

//ROUTES ETO
const adminRoutes = require('./routes/adminRoutes');
const frontlineRoutes = require('./routes/frontlineRoutes');

// App Initialization
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(express.json()); // To parse JSON bodies
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files like CSS

// Session Middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if you're using https
}));

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//Use Routes
app.use('/admin', adminRoutes);
app.use('/', frontlineRoutes);


// MONGO
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('✅ Successfully connected to MongoDB.');
        
        // Start the server only after the DB connection is successful
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error('Database connection error:', err);
    });