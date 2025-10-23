// File: seedAssistant.js
// Added: Script to create a specific Assistant Manager user.

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user');
const Branch = require('./models/branch');

// --- Assistant Manager Details ---
const ASSISTANT_DETAILS = {
    firstName: "R J", // Will be used to construct username
    lastName: "Salcedo",
    contactNumber: "+639504788697",
    password: "Password123!", // Plain text password - the User model will hash this
    role: "Super Admin"
};
// ---------------------------------

const runAssistantSeeder = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Successfully connected to MongoDB for Assistant Manager seeding.');

        // 1. Check if user already exists
        console.log(`🔍 Checking for existing user with phone number ${ASSISTANT_DETAILS.contactNumber}...`);
        const existingUser = await User.findOne({ contactNumber: ASSISTANT_DETAILS.contactNumber });
        if (existingUser) {
            console.log(`🟡 User with phone number ${ASSISTANT_DETAILS.contactNumber} already exists.`);
            await mongoose.disconnect();
            return;
        }

        // 2. Fetch an active branch to assign the user to
        console.log('🔍 Fetching an active branch...');
        const firstActiveBranch = await Branch.findOne({ status: 'Active' });

        if (!firstActiveBranch) {
            console.error('❌ Cannot create Assistant Manager. No active branches found. Please add an active branch first.');
            await mongoose.disconnect();
            return;
        }
        console.log(`✅ Found active branch: ${firstActiveBranch.name} (${firstActiveBranch._id})`);

        // 3. Create the user object
        console.log('⚙️ Preparing Assistant Manager user data...');
        const username = `${ASSISTANT_DETAILS.firstName.toLowerCase().replace(/\s/g, '')}.${ASSISTANT_DETAILS.lastName.toLowerCase().replace(/\s/g, '')}`;

        const newUser = new User({
            username: username, // Construct a username
            contactNumber: ASSISTANT_DETAILS.contactNumber,
            password: ASSISTANT_DETAILS.password, // Pass plain text, model will hash
            role: ASSISTANT_DETAILS.role,
            branch: firstActiveBranch._id // Assign to the first found active branch
        });

        // 4. Save the new user (pre-save hook will hash password)
        console.log(`⏳ Creating user ${username}...`);
        await newUser.save();
        console.log(`✅ Successfully created Assistant Manager: ${username} with phone ${ASSISTANT_DETAILS.contactNumber}`);

    } catch (error) {
         if (error.name === 'ValidationError') {
            console.error('❌ Validation Error creating Assistant Manager:');
            for (let field in error.errors) {
                console.error(`  - ${error.errors[field].message}`);
            }
        } else {
            console.error('❌ An error occurred during the Assistant Manager seeding process:', error);
        }
    } finally {
        // 5. Disconnect from the database
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB.');
    }
};

runAssistantSeeder();