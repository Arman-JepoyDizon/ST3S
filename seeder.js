// File: seeder.js
// Description: A script to populate the database with fake transaction data for testing.

require('dotenv').config();
const mongoose = require('mongoose');

// Import your models
const Product = require('./models/product');
const User = require('./models/user');
const Transaction = require('./models/transaction');
const Price = require('./models/price'); // Needed for accurate pricing
const Size = require('./models/size');     // Needed for variant details

// --- Configuration ---
const NUM_TRANSACTIONS_TO_CREATE = 200;
// ---------------------

/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 */
const getRandomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Returns a random date within the last 'days' from now.
 */
const getRandomDate = (days) => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - getRandomInt(0, days));
    return pastDate;
};

const runSeeder = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Successfully connected to MongoDB for seeding.');

        // 1. Clear existing transactions to avoid duplicates
        console.log('🗑️  Deleting old transactions...');
        await Transaction.deleteMany({});
        console.log('✅ Old transactions deleted.');

        // 2. Fetch necessary data to build realistic transactions
        console.log('🔍 Fetching existing products and users...');
        const products = await Product.find({});
        const users = await User.find({ role: { $in: ['Admin', 'Front Liner'] } });

        if (products.length === 0) {
            console.error('❌ Cannot seed transactions. No products found in the database. Please add some products first.');
            return;
        }
        if (users.length === 0) {
            console.error('❌ Cannot seed transactions. No Admin or Front Liner users found.');
            return;
        }
        console.log(`✅ Found ${products.length} products and ${users.length} users.`);

        // 3. Generate fake transactions
        console.log(`🌱 Generating ${NUM_TRANSACTIONS_TO_CREATE} new transactions...`);
        const transactions = [];
        const statuses = ['Completed', 'Completed', 'Completed', 'Completed', 'Cancelled', 'Ready'];

        for (let i = 0; i < NUM_TRANSACTIONS_TO_CREATE; i++) {
            const transactionItems = [];
            let totalAmount = 0;
            const numItemsInOrder = getRandomInt(1, 5);

            for (let j = 0; j < numItemsInOrder; j++) {
                const randomProduct = products[getRandomInt(0, products.length - 1)];
                const quantity = getRandomInt(1, 3);
                
                // Check if the product has variants
                const productPrices = await Price.find({ productId: randomProduct._id, status: 'Active' });
                let chosenPriceInfo = productPrices[getRandomInt(0, productPrices.length - 1)];

                let sizeLabel = null;
                if (chosenPriceInfo && chosenPriceInfo.sizeId) {
                    const size = await Size.findById(chosenPriceInfo.sizeId);
                    sizeLabel = size ? size.label : null;
                }

                const price = chosenPriceInfo ? chosenPriceInfo.price : randomProduct.price;

                transactionItems.push({
                    productId: randomProduct._id,
                    quantity: quantity,
                    price: price,
                    sizeLabel: sizeLabel,
                });
                totalAmount += quantity * price;
            }

            const randomUser = users[getRandomInt(0, users.length - 1)];

            const newTransaction = {
                items: transactionItems,
                totalAmount: totalAmount,
                createdBy: randomUser._id,
                status: statuses[getRandomInt(0, statuses.length - 1)],
                createdAt: getRandomDate(365), // Spread transactions over the last year
            };
            transactions.push(newTransaction);
        }

        // 4. Insert all generated transactions into the database
        await Transaction.insertMany(transactions);
        console.log(`✅ Successfully seeded ${transactions.length} transactions into the database.`);

    } catch (error) {
        console.error('❌ An error occurred during the seeding process:', error);
    } finally {
        // 5. Disconnect from the database
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB.');
    }
};

runSeeder();