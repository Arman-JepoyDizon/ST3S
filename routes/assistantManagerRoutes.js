// File: routes/assistantManagerRoutes.js
// Added: Routes for Assistant Manager role to manage staff applications.

const express = require('express');
const router = express.Router();
// Fixed: Correctly require the controller file
const assistantManagerController = require('../controllers/assistantManagerController');

// Middleware to ensure the user is an Assistant Manager
const isAssistantManager = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'Assistant Manager') {
        return next();
    }
    // Redirect other logged-in users or send to login
    if (req.session.user) {
         // Redirect based on role if already logged in but wrong role
        if (req.session.user.role === 'Super Admin') return res.redirect('/superadmin/dashboard');
        if (req.session.user.role === 'Admin') return res.redirect('/admin/dashboard');
        if (req.session.user.role === 'Cook') return res.redirect('/cook/dashboard');
        if (req.session.user.role === 'Front Liner') return res.redirect('/');
    }
    // If not logged in at all
    res.redirect('/login');
};

// Apply the middleware to all routes in this file
router.use(isAssistantManager);

// Route to display the list of staff registrations/applications
router.get('/registrations', assistantManagerController.getRegistrationsPage);

// Route to get details of a specific application (e.g., for the modal)
router.get('/registrations/:id', assistantManagerController.getApplicationDetails);

// Route to handle approving an application
router.post('/registrations/:id/approve', assistantManagerController.approveApplication);

// Route to handle rejecting an application
router.post('/registrations/:id/reject', assistantManagerController.rejectApplication);

// delete
router.post('/registrations/:id/delete', assistantManagerController.deleteApplication);


module.exports = router;