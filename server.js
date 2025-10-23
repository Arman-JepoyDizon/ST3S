// File: server.js

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");

// Route imports - Ensure this path is correct relative to server.js
const adminRoutes = require('./routes/adminRoutes');
const frontlineRoutes = require('./routes/frontlineRoutes');
const cookRoutes = require('./routes/cookRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const assistantManagerRoutes = require('./routes/assistantManagerRoutes'); // Make sure this line exists and the path is correct

// App Initialization
const app = express();
const server = http.createServer(app);
const io = new Server(server);

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
    cookie: { secure: false } // Set to true in production with HTTPS
}));

// Make io accessible to our router
app.use((req, res, next) => {
    req.io = io;
    next();
});

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- App Routes --- (Order might matter slightly, ensure assistant is included)
app.use('/superadmin', superAdminRoutes);
app.use('/admin', adminRoutes);
app.use('/assistant', assistantManagerRoutes); // Make sure this line exists and uses the correct variable
app.use('/cook', cookRoutes);
app.use('/', frontlineRoutes); // Frontline (including login) should generally be last if it has broad paths like '/'

// --- Socket.IO Connection ---
io.on('connection', (socket) => {
    console.log('🔌 A user connected via WebSocket');
    socket.on('disconnect', () => {
        console.log(' A user disconnected');
    });
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('✅ Successfully connected to MongoDB.'); // Updated log message

        server.listen(PORT, () => {
            console.log(`🚀 Server is running on http://localhost:${PORT}`); // Updated log message
        });
    })
    .catch(err => {
        console.error('❌ Database connection error:', err); // Updated log message
    });