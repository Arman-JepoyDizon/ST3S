// File: fix-transactions.js
require('dotenv').config();
const mongoose = require('mongoose');
const Transaction = require('./models/transaction');
const User = require('./models/user');

const runMigration = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB to fix transactions.');

        // Find all transactions that are missing a branch field
        const transactionsToFix = await Transaction.find({ branch: { $exists: false } });

        if (transactionsToFix.length === 0) {
            console.log('🎉 No transactions to fix. All data is up to date.');
            return;
        }

        console.log(`🔍 Found ${transactionsToFix.length} transactions to update...`);
        let updatedCount = 0;

        for (const transaction of transactionsToFix) {
            // Find the user who created the transaction
            const user = await User.findById(transaction.createdBy);

            if (user && user.branch) {
                // Update the transaction with the user's branch ID
                transaction.branch = user.branch;
                await transaction.save();
                updatedCount++;
                console.log(`  -> Updated transaction ${transaction._id} with branch ${user.branch}`);
            } else {
                console.log(`  -> ⚠️  Skipping transaction ${transaction._id}: could not find user or user has no branch.`);
            }
        }

        console.log(`✅ Finished. Successfully updated ${updatedCount} of ${transactionsToFix.length} transactions.`);

    } catch (error) {
        console.error('❌ An error occurred during the migration:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB.');
    }
};

runMigration();