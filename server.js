// File: server.js

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const http = require('http'); // Added: Node's native HTTP module
const { Server } = require("socket.io"); // Added: Socket.IO server

// Route imports
const adminRoutes = require('./routes/adminRoutes');
const frontlineRoutes = require('./routes/frontlineRoutes');
const cookRoutes = require('./routes/cookRoutes');
const bcrypt = require('bcryptjs');

// App Initialization
const app = express();
const server = http.createServer(app); // Create an HTTP server from the Express app
const io = new Server(server); // Attach Socket.IO to the HTTP server

const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session Middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Make io accessible to our router
app.use((req, res, next) => {
    req.io = io;
    next();
});

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- App Routes ---
app.use('/admin', adminRoutes);
app.use('/cook', cookRoutes);
app.use('/', frontlineRoutes);

// --- Socket.IO Connection ---
io.on('connection', (socket) => {
    console.log('🔌 A user connected via WebSocket');
    socket.on('disconnect', () => {
        console.log(' disconnected');
    });
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('✅ Successfully connected to MongoDB.');
        
        // Start the HTTP server instead of the Express app
        server.listen(PORT, () => {
            console.log(`🚀 Server is running on http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error('Database connection error:', err);
    });