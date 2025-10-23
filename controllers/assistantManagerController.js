// File: controllers/assistantManagerController.js
// Updated: Include firstName and lastName when creating user from application.

const StaffApplication = require('../models/staffApplication');
const User = require('../models/user');
const Branch = require('../models/branch');
const mongoose = require('mongoose');

// Function to display the staff registrations page
const getRegistrationsPage = async (req, res) => {
    try {
        const { search, status } = req.query;
        let filterQuery = { status: status || 'Pending' }; // Default to Pending

        // Add search functionality (e.g., by name or phone)
        if (search) {
            const searchRegex = new RegExp(search, 'i'); // Case-insensitive search
            filterQuery.$or = [
                { firstName: searchRegex },
                { lastName: searchRegex },
                { contactNumber: searchRegex }
            ];
        }

        // Fetch applications based on filter, populate branch name
        const applications = await StaffApplication.find(filterQuery)
            .populate('preferredBranch', 'name') // Get the branch name
            .sort({ createdAt: 1 }); // Show oldest first

        res.render('assistantManager/registrations', { // Path to the new view
            user: req.session.user, // Pass user session info
            applications: applications,
            activePage: 'registrations', // For navigation highlighting
            query: req.query // Pass query params for filters
        });
    } catch (error) {
        console.error('Error fetching staff applications:', error);
        res.status(500).send('Server Error');
    }
};

// Function to get details of a specific application (e.g., for modal)
const getApplicationDetails = async (req, res) => {
    try {
        const applicationId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(applicationId)) {
            return res.status(400).json({ message: 'Invalid application ID format.' });
        }

        const application = await StaffApplication.findById(applicationId)
            .populate('preferredBranch', 'name'); // Populate branch name

        if (!application) {
            return res.status(404).json({ message: 'Application not found.' });
        }

        // Return relevant details (don't send the password hash)
        res.status(200).json({
            id: application._id,
            fullName: `${application.firstName} ${application.middleName ? application.middleName + ' ' : ''}${application.lastName}`,
            firstName: application.firstName, // Send separate names for user creation
            lastName: application.lastName,   // Send separate names for user creation
            contactNumber: application.contactNumber,
            positionApplied: application.positionApplied,
            preferredBranch: application.preferredBranch ? application.preferredBranch.name : 'N/A',
            preferredBranchId: application.preferredBranch ? application.preferredBranch._id : null, // Needed for User creation
            appliedDate: application.createdAt,
            status: application.status
            // Exclude password
        });
    } catch (error) {
        console.error('Error fetching application details:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};


// Function to approve a staff application
const approveApplication = async (req, res) => {
    const applicationId = req.params.id;
    const assistantManagerId = req.session.user.id;

    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
         return res.status(400).send('Invalid application ID format.');
    }

    try {
        const application = await StaffApplication.findById(applicationId);

        if (!application) { return res.status(404).send('Application not found.'); }
        if (application.status !== 'Pending') { return res.status(400).send(`Application is already ${application.status}.`); }

        const existingUser = await User.findOne({ contactNumber: application.contactNumber });
        if (existingUser) {
            application.status = 'Rejected';
            application.reviewedBy = assistantManagerId;
            application.reviewedAt = new Date();
            await application.save();
            console.warn(`Application ${applicationId} rejected because contact number ${application.contactNumber} already exists in Users.`);
            return res.redirect('/assistant/registrations');
        }

        // Use names for username generation
        const potentialUsername = `${application.firstName.toLowerCase().replace(/\s/g, '')}.${application.lastName.toLowerCase().replace(/\s/g, '')}`;

        // Updated: Add firstName and lastName to the newUser object
        const newUser = new User({
            firstName: application.firstName, // Added
            lastName: application.lastName,   // Added
            username: potentialUsername,
            contactNumber: application.contactNumber,
            password: application.password, // Transfer the HASHED password
            role: application.positionApplied,
            branch: application.preferredBranch
        });

        // Set the flag to skip validation/hashing in the pre-save hook
        newUser._skipPasswordValidationAndHashing = true;

        // Save the new user
        await newUser.save({ validateBeforeSave: false });

        // Update the application status
        application.status = 'Approved';
        application.reviewedBy = assistantManagerId;
        application.reviewedAt = new Date();
        await application.save();

        res.redirect('/assistant/registrations');

    } catch (error) {
        console.error('Error approving application:', error);
        res.status(500).send('Server Error during approval process.');
    }
};

// Function to reject a staff application
const rejectApplication = async (req, res) => {
    const applicationId = req.params.id;
    const assistantManagerId = req.session.user.id;

     if (!mongoose.Types.ObjectId.isValid(applicationId)) {
         return res.status(400).send('Invalid application ID format.');
    }

    try {
        const application = await StaffApplication.findById(applicationId);

        if (!application) {
            return res.status(404).send('Application not found.');
        }

        if (application.status !== 'Pending') {
            return res.status(400).send(`Application is already ${application.status}.`);
        }

        application.status = 'Rejected';
        application.reviewedBy = assistantManagerId;
        application.reviewedAt = new Date();
        await application.save();

        res.redirect('/assistant/registrations');

    } catch (error) {
        console.error('Error rejecting application:', error);
        res.status(500).send('Server Error during rejection.');
    }
};

// Function to permanently delete a rejected application
const deleteApplication = async (req, res) => {
    const applicationId = req.params.id;
    const assistantManagerId = req.session.user.id; // Optional: log who deleted it

    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
         return res.status(400).send('Invalid application ID format.');
    }

    try {
        const application = await StaffApplication.findById(applicationId);

        if (!application) {
            return res.status(404).send('Application not found.');
        }

        // Optional but recommended: Only allow deletion if status is 'Rejected'
        if (application.status !== 'Rejected') {
            return res.status(400).send(`Only rejected applications can be deleted. This application is ${application.status}.`);
        }

        // Perform the deletion
        await StaffApplication.findByIdAndDelete(applicationId);

        console.log(`Application ${applicationId} deleted by ${assistantManagerId}`); // Optional logging

        res.redirect('/assistant/registrations?status=Rejected'); // Redirect back to the rejected list

    } catch (error) {
        console.error('Error deleting application:', error);
        res.status(500).send('Server Error during deletion.');
    }
};


module.exports = {
    getRegistrationsPage,
    getApplicationDetails,
    approveApplication,
    rejectApplication,
    deleteApplication
};