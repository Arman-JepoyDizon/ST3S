// File: controllers/adminController.js
// Contains all Admin controller functions with updates for user fields, role restrictions, category lock, and live order filtering.

const Product = require('../models/product');
const Price = require('../models/price');
const User = require('../models/user');
const Category = require('../models/category');
const Transaction = require('../models/transaction');
const Size = require('../models/size');
const Branch = require('../models/branch');
const mongoose = require('mongoose');

// --- Analytics ---
const getAnalyticsPage = async (req, res) => {
    try {
        const { filter, dateRange } = req.query;
        let startDate = new Date();
        let endDate = new Date();
        let currentFilter = filter || 'today';
        let customDateRange = null;

        endDate.setHours(23, 59, 59, 999);

        if (dateRange) {
            const [startDateStr, endDateStr] = dateRange.split(' to ');
            startDate = new Date(startDateStr);
            startDate.setHours(0, 0, 0, 0);
            endDate = endDateStr ? new Date(endDateStr) : new Date(startDate);
            endDate.setHours(23, 59, 59, 999);
            currentFilter = 'custom';
            customDateRange = {
                start: startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                end: endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            };
        } else {
            switch (currentFilter) {
                case 'week': startDate.setDate(startDate.getDate() - 6); startDate.setHours(0, 0, 0, 0); break;
                case 'month': startDate.setMonth(startDate.getMonth() - 1); startDate.setHours(0, 0, 0, 0); break;
                case 'year': startDate.setFullYear(startDate.getFullYear() - 1); startDate.setHours(0, 0, 0, 0); break;
                case 'today': default: startDate.setHours(0, 0, 0, 0); currentFilter = 'today'; break;
            }
        }

        const branchObjectId = new mongoose.Types.ObjectId(req.session.user.branch);
        const dateQuery = { createdAt: { $gte: startDate, $lte: endDate } };
        const branchQuery = { branch: branchObjectId };
        const matchQuery = { ...dateQuery, ...branchQuery };

        const totalOrders = await Transaction.countDocuments(matchQuery);
        const salesData = await Transaction.aggregate([
            { $match: { status: 'Completed', ...matchQuery } },
            { $group: { _id: null, totalSales: { $sum: '$totalAmount' } } }
        ]);
        const totalSales = salesData.length > 0 ? salesData[0].totalSales : 0;

        const bestSellers = await Transaction.aggregate([
            { $match: { status: 'Completed', ...matchQuery } }, { $unwind: '$items' },
            { $group: { _id: { productId: '$items.productId', sizeLabel: '$items.sizeLabel' }, totalQuantity: { $sum: '$items.quantity' }, totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } } } },
            { $sort: { totalRevenue: -1 } }, { $limit: 5 },
            { $lookup: { from: 'products', localField: '_id.productId', foreignField: '_id', as: 'productDetails' } },
            { $unwind: '$productDetails' }
        ]);

        let salesTrendData;
        if (currentFilter === 'year' || (currentFilter === 'custom' && (endDate - startDate) / (1000 * 60 * 60 * 24) > 60)) {
            const monthlySales = await Transaction.aggregate([ { $match: { status: 'Completed', ...matchQuery } }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Manila" } }, monthlyTotal: { $sum: "$totalAmount" } } }, { $sort: { _id: 1 } } ]);
            const salesMap = new Map(monthlySales.map(d => [d._id, d.monthlyTotal]));
            const labels = []; const data = []; let dateIterator = new Date(startDate);
            while (dateIterator <= endDate) { const year = dateIterator.getFullYear(); const month = String(dateIterator.getMonth() + 1).padStart(2, '0'); const monthString = `${year}-${month}`; const currentLabel = dateIterator.toLocaleString('en-US', { month: 'short', year: 'numeric' }); if (!labels.includes(currentLabel)) { labels.push(currentLabel); data.push(salesMap.get(monthString) || 0); } dateIterator.setMonth(dateIterator.getMonth() + 1); }
            salesTrendData = { labels, data, title: 'Sales Trend (Monthly)' };
        } else {
            if (currentFilter === 'today') {
                const hourlySales = await Transaction.aggregate([ { $match: { status: 'Completed', ...matchQuery } }, { $group: { _id: { $floor: { $divide: [{ $hour: { date: "$createdAt", timezone: "Asia/Manila" } }, 2] } }, hourlyTotal: { $sum: "$totalAmount" } } } ]);
                const salesMap = new Map(hourlySales.map(d => [d._id, d.hourlyTotal]));
                const labels = [ '12-2am', '2-4am', '4-6am', '6-8am', '8-10am', '10-12pm', '12-2pm', '2-4pm', '4-6pm', '6-8pm', '8-10pm', '10-12am' ]; const data = [];
                for (let i = 0; i < 12; i++) { data.push(salesMap.get(i) || 0); }
                salesTrendData = { labels, data, title: 'Sales Trend (Today)' };
            } else {
                const title = `Sales Trend (${customDateRange ? `${customDateRange.start} - ${customDateRange.end}` : currentFilter.charAt(0).toUpperCase() + currentFilter.slice(1)})`;
                const dailySales = await Transaction.aggregate([ { $match: { status: 'Completed', ...matchQuery } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Manila" } }, dailyTotal: { $sum: "$totalAmount" } } }, { $sort: { _id: 1 } } ]);
                const salesMap = new Map(dailySales.map(d => [d._id, d.dailyTotal]));
                const labels = []; const data = []; let dateIterator = new Date(startDate);
                const formatDateToYYYYMMDD = (date) => { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; };
                while (dateIterator <= endDate) { const dateString = formatDateToYYYYMMDD(dateIterator); labels.push(dateIterator.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })); data.push(salesMap.get(dateString) || 0); dateIterator.setDate(dateIterator.getDate() + 1); }
                salesTrendData = { labels, data, title };
            }
        }

        const recentTransactions = await Transaction.find({ branch: req.session.user.branch })
            .sort({ createdAt: -1 }).limit(5).populate('createdBy', 'username').populate('items.productId', 'name');

        const topProductsData = {
            labels: bestSellers.map(p => `${p.productDetails.name}${p._id.sizeLabel ? ` - ${p._id.sizeLabel}` : ''}`),
            data: bestSellers.map(p => p.totalQuantity)
        };

        res.render('admin/dashboard', {
            user: req.session.user, activePage: 'analytics', totalSales, totalOrders, bestSellers,
            salesTrendData, topProductsData, recentTransactions, currentFilter, customDateRange, query: req.query
        });

    } catch (error) {
        console.error('Error fetching analytics data:', error);
        res.status(500).send('Server error');
    }
};

// --- Order Management ---
const getOrdersPage = async (req, res) => {
    try {
        const { search, dateRange, status } = req.query;
        let filterQuery = { branch: req.session.user.branch };
        if (dateRange) { const [startDateStr, endDateStr] = dateRange.split(' to '); if(startDateStr){ const startDate = new Date(startDateStr); startDate.setHours(0,0,0,0); const endDate = endDateStr ? new Date(endDateStr) : new Date(startDate); endDate.setHours(23,59,59,999); filterQuery.createdAt = { $gte: startDate, $lte: endDate }; } }
        if (status && ['Pending', 'Ready', 'Completed', 'Cancelled'].includes(status)) { filterQuery.status = status; }

        let transactions = await Transaction.find(filterQuery)
            .sort({ createdAt: -1 })
            .populate('createdBy', 'username')
            .populate('items.productId', 'name');

        // Apply initial search filter *after* fetching if present
        if (search && search.trim() !== '') {
            const searchTerm = search.trim().toLowerCase();
            transactions = transactions.filter(t =>
                t._id.toString().slice(-6).toLowerCase().includes(searchTerm)
            );
        }

        const totalTransactionsCount = await Transaction.countDocuments({ branch: req.session.user.branch }); // Total in branch

        res.render('admin/orders', {
            user: req.session.user,
            transactions: transactions, // Initially filtered list
            totalTransactionsCount: totalTransactionsCount,
            query: req.query,
            activePage: 'orders'
        });
    } catch (error) {
        console.error('Error fetching orders page:', error);
        res.status(500).send('Server Error');
    }
};

const getOrdersCount = async (req, res) => {
    try {
        const { dateRange, status } = req.query;
        let filterQuery = { branch: req.session.user.branch };
        if (dateRange) { const [startDateStr, endDateStr] = dateRange.split(' to '); if(startDateStr){ const startDate = new Date(startDateStr); startDate.setHours(0,0,0,0); const endDate = endDateStr ? new Date(endDateStr) : new Date(startDate); endDate.setHours(23,59,59,999); filterQuery.createdAt = { $gte: startDate, $lte: endDate }; } }
        if (status && ['Pending', 'Ready', 'Completed', 'Cancelled'].includes(status)) { filterQuery.status = status; }
        const count = await Transaction.countDocuments(filterQuery);
        res.json({ count });
    } catch (error) {
        console.error('Error fetching transaction count:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const exportOrders = async (req, res) => {
    try {
        const { dateRange, status, fields } = req.query;
        let filterQuery = { branch: req.session.user.branch };
        if (dateRange) { const [startDateStr, endDateStr] = dateRange.split(' to '); if(startDateStr){ const startDate = new Date(startDateStr); startDate.setHours(0,0,0,0); const endDate = endDateStr ? new Date(endDateStr) : new Date(startDate); endDate.setHours(23,59,59,999); filterQuery.createdAt = { $gte: startDate, $lte: endDate }; } }
        if (status && ['Pending', 'Ready', 'Completed', 'Cancelled'].includes(status)) { filterQuery.status = status; }
        const transactions = await Transaction.find(filterQuery).sort({ createdAt: -1 }).populate('createdBy', 'username').populate('items.productId', 'name');
        const exportFields = Array.isArray(fields) ? fields : (fields ? [fields] : []);
        if (exportFields.length === 0) { return res.status(400).send('No fields selected for export.'); }
        const headerMap = { orderId: 'Order Number', date: 'Date', time: 'Time', items: 'Item Details', status: 'Status', totalAmount: 'Total Amount', createdBy: 'Created By', paymentMethod: 'Payment Method', customerName: 'Customer Name', discount: 'Discount Details' };
        const csvHeaders = exportFields.map(field => headerMap[field] || field);
        const sanitizeField = (field) => { if (field == null) return ''; const str = String(field); if (str.includes(',') || str.includes('"') || str.includes('\n')) { return `"${str.replace(/"/g, '""')}"`; } return str; };
        const csvRows = transactions.map(t => { const row = { orderId: `ORD-${t._id.toString().slice(-6).toUpperCase()}`, date: new Date(t.createdAt).toLocaleDateString('en-CA'), time: new Date(t.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }), items: t.items.map(item => `${item.quantity}x ${item.productId ? item.productId.name : 'N/A'}${item.sizeLabel ? ` (${item.sizeLabel})` : ''}`).join('; '), status: t.status, totalAmount: t.totalAmount.toFixed(2), createdBy: t.createdBy ? t.createdBy.username : 'N/A', paymentMethod: t.paymentMethod, customerName: t.customerName || '', discount: t.discountApplied ? `Yes (-${t.discountAmount.toFixed(2)})` : 'No', }; return exportFields.map(field => sanitizeField(row[field])).join(','); });
        const csvString = [csvHeaders.join(','), ...csvRows].join('\n');
        const fileName = `Miras-Transactions-${new Date().toISOString().slice(0, 10)}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.status(200).send(csvString);
    } catch (error) {
        console.error('Error exporting orders:', error);
        res.status(500).send('Server Error during export.');
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const transaction = await Transaction.findOne({ _id: id, branch: req.session.user.branch });
        if (!transaction) { return res.status(404).json({ message: 'Order not found or you do not have permission to modify it.' }); }
        const oldStatus = transaction.status;
        transaction.status = status;
        await transaction.save();
        req.io.emit('orderStatusUpdated', { orderId: id, oldStatus: oldStatus, newStatus: status });
        req.io.emit('superAdminNewOrder', { branchId: transaction.branch });
        res.status(200).json({ success: true, message: 'Order status updated successfully.' });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Server error while updating status.' });
    }
};

const getOrdersData = async (req, res) => {
    try {
        const { search, dateRange, status } = req.query;
        let filterQuery = { branch: req.session.user.branch };
        if (dateRange) { const [startDateStr, endDateStr] = dateRange.split(' to '); if (startDateStr) { const startDate = new Date(startDateStr); startDate.setHours(0, 0, 0, 0); const endDate = endDateStr ? new Date(endDateStr) : new Date(startDate); endDate.setHours(23, 59, 59, 999); filterQuery.createdAt = { $gte: startDate, $lte: endDate }; } }
        if (status && ['Pending', 'Ready', 'Completed', 'Cancelled'].includes(status)) { filterQuery.status = status; }
        console.log("Executing Order Data Query (pre-search):", JSON.stringify(filterQuery));
        let transactions = await Transaction.find(filterQuery).sort({ createdAt: -1 }).populate('createdBy', 'username').populate('items.productId', 'name');
        if (search && search.trim() !== '') { const searchTerm = search.trim().toLowerCase(); transactions = transactions.filter(t => t._id.toString().slice(-6).toLowerCase().includes(searchTerm)); console.log(`Filtered down to ${transactions.length} transactions after searching for "${searchTerm}"`); }
        const totalFilteredCount = transactions.length;
        const totalBranchCount = await Transaction.countDocuments({ branch: req.session.user.branch });
        res.json({ transactions: transactions, totalFilteredCount: totalFilteredCount, totalBranchCount: totalBranchCount, query: req.query });
    } catch (error) {
        console.error('Error fetching orders data (JSON):', error);
        res.status(500).json({ error: 'Server Error fetching order data' });
    }
};

const renderOrdersList = async (req, res) => {
     try {
        const { search, dateRange, status, target } = req.query;
        let filterQuery = { branch: req.session.user.branch };
        if (dateRange) { const [startDateStr, endDateStr] = dateRange.split(' to '); if(startDateStr){ const startDate = new Date(startDateStr); startDate.setHours(0,0,0,0); const endDate = endDateStr ? new Date(endDateStr) : new Date(startDate); endDate.setHours(23,59,59,999); filterQuery.createdAt = { $gte: startDate, $lte: endDate }; } }
        if (status && ['Pending', 'Ready', 'Completed', 'Cancelled'].includes(status)) { filterQuery.status = status; }
        console.log("Executing Order List Query (pre-search):", JSON.stringify(filterQuery));
        let transactions = await Transaction.find(filterQuery).sort({ createdAt: -1 }).populate('createdBy', 'username').populate('items.productId', 'name');
        if (search && search.trim() !== '') { const searchTerm = search.trim().toLowerCase(); transactions = transactions.filter(t => t._id.toString().slice(-6).toLowerCase().includes(searchTerm)); console.log(`Rendering list with ${transactions.length} transactions after searching for "${searchTerm}"`); }
        res.render('admin/_ordersList', { transactions: transactions, target: target || 'desktop' });
    } catch (error) {
        console.error('Error rendering orders list partial:', error);
        res.status(500).send('<div class="alert alert-danger">Error loading order list.</div>');
    }
};

// --- Product Management ---
const getProducts = async (req, res) => {
    try {
        const products = await Product.find({ branches: req.session.user.branch }).populate('category', 'name');
        res.render('admin/products', { user: req.session.user, products: products, activePage: 'products' });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send('Server error while fetching products.');
    }
};

const getAddProductPage = async (req, res) => {
    try {
        const categories = await Category.find();
        res.render('admin/addProduct', { user: req.session.user, categories: categories, activePage: 'products' });
    } catch (error) {
        console.error('Error getting add product page:', error);
        res.status(500).send('Server error.');
    }
};

const postAddProduct = async (req, res) => {
    try {
        const { name, price, size, category, imageUrl } = req.body;
        const prices = Array.isArray(price) ? price : [price];
        let sizes = Array.isArray(size) ? (size || []).filter(s => s && s.trim() !== '') : [];
        if (!name || !prices[0] || !category) {
             const categories = await Category.find();
            return res.status(400).render('admin/addProduct', { user: req.session.user, categories: categories, activePage: 'products', errors: ['Missing required fields (Name, Price, Category).'], input: req.body });
         }
        const productExist = await Product.findOne({ name: name, branches: req.session.user.branch });
        if(productExist){
            console.log("Product name already exists in this branch");
             const categories = await Category.find();
            return res.status(400).render('admin/addProduct', { user: req.session.user, categories: categories, activePage: 'products', errors: [`Product name "${name}" already exists in this branch.`], input: req.body });
        }
        const lowestPrice = Math.min(...prices.map(p => parseFloat(p)));
        const newProduct = await Product.create({ name, price: lowestPrice, category, imageUrl, branches: [req.session.user.branch] });
        if (sizes.length > 0) {
            for (let i = 0; i < sizes.length; i++) {
                const insertedSize = await Size.create({ productId: newProduct._id, label: sizes[i] });
                await Price.create({ productId: newProduct._id, sizeId: insertedSize._id, price: prices[i] });
            }
        } else {
            await Price.create({ productId: newProduct._id, price: prices[0] });
        }
        res.redirect('/admin/products');
    } catch (error) {
        console.error('Error adding product:', error);
         const categories = await Category.find();
         res.status(500).render('admin/addProduct', { user: req.session.user, categories: categories, activePage: 'products', errors: [error.message || 'Server error while adding product.'], input: req.body });
    }
};

const getEditProductPage = async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.id, branches: req.session.user.branch });
        if (!product) { return res.status(404).send("Product not found or not available in this branch."); }
        const sizes = await Size.find({ productId: req.params.id, status: 'Active' });
        const prices = await Price.find({ productId: req.params.id, status: 'Active' });
        const categories = await Category.find();
        const pastSinglePrices = await Price.find({ productId: req.params.id, status: "Inactive", sizeId: null }).sort({ createdAt: -1 });
        const pastSizePrices = await Price.find({ productId: req.params.id, status: "Inactive", sizeId: { $ne: null } }).sort({ createdAt: -1 });
        const pastProductSizes = await Size.find({ productId: req.params.id, status: "Inactive" }).sort({ createdAt: -1 });
        res.render('admin/editProduct', { user: req.session.user, product, sizes, prices, categories, pastSinglePrices, pastSizePrices, pastProductSizes, activePage: 'products' });
    } catch (error) {
        console.error('Error fetching product for edit:', error);
        res.status(500).send('Server error.');
    }
};

const postUpdateProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const { name, price, size, category, imageUrl } = req.body;
        const productToUpdate = await Product.findOne({ _id: productId, branches: req.session.user.branch });
        if (!productToUpdate) { return res.status(403).send("You do not have permission to edit this product."); }
        const prices = Array.isArray(price) ? price : [price];
        let sizes = Array.isArray(size) ? (size || []).filter(s => s && s.trim() !== '') : [];
        if (!name || !prices[0] || !category) { return res.status(400).send("Missing required fields."); }
        const lowestPrice = Math.min(...prices.map(p => parseFloat(p)));
        const existingSizes = await Size.find({ productId });
        if (existingSizes.length > 0 && sizes.length === 0) { await Price.updateMany({ productId }, { status: "Inactive" }); await Size.updateMany({ productId }, { status: "Inactive" }); await Price.create({ productId, price: prices[0], status: "Active" }); } // Updated Size logic
        else if (existingSizes.length === 0 && sizes.length > 0) { await Price.updateMany({ productId, sizeId: null }, { status: "Inactive" }); for (let i = 0; i < sizes.length; i++) { const newSize = await Size.create({ productId, label: sizes[i].trim(), status: "Active" }); await Price.create({ productId, sizeId: newSize._id, price: parseFloat(prices[i] || prices[0]), status: "Active" }); } } // Updated Size logic
        else if (sizes.length > 0) { const keepSizeIds = new Set(); for (let i = 0; i < sizes.length; i++) { const newLabel = String(sizes[i]).trim(); const newPrice = parseFloat(prices[i] || prices[0]); let sizeDoc = existingSizes.find(s => s.label.toLowerCase() === newLabel.toLowerCase()); if (sizeDoc) { await Size.findByIdAndUpdate(sizeDoc._id, { status: "Active" }); const currentPrice = await Price.findOne({ productId, sizeId: sizeDoc._id, status: "Active" }); if (!currentPrice || currentPrice.price !== newPrice) { if (currentPrice) await Price.findByIdAndUpdate(currentPrice._id, { status: "Inactive" }); await Price.create({ productId, sizeId: sizeDoc._id, price: newPrice, status: "Active" }); } } else { sizeDoc = await Size.create({ productId, label: newLabel, status: "Active" }); await Price.create({ productId, sizeId: sizeDoc._id, price: newPrice, status: "Active" }); } keepSizeIds.add(String(sizeDoc._id)); } const toDeactivate = existingSizes.filter(s => !keepSizeIds.has(String(s._id))); for (const s of toDeactivate) { await Size.findByIdAndUpdate(s._id, { status: "Inactive" }); await Price.updateMany({ productId, sizeId: s._id, status: "Active" }, { status: "Inactive" }); } } // Updated Size logic
        else { const currentPrice = await Price.findOne({ productId, sizeId: null, status: 'Active' }); if (!currentPrice || currentPrice.price !== parseFloat(prices[0])) { if (currentPrice) await Price.findByIdAndUpdate(currentPrice._id, { status: 'Inactive' }); await Price.create({ productId, price: prices[0], status: 'Active' }); } }
        await Product.findByIdAndUpdate(productId, { name, price: lowestPrice, category, imageUrl });
        return res.redirect("/admin/products");
    } catch (error) {
        console.error("❌ Error updating product:", error);
        res.status(500).send("Server error while updating product.");
    }
};

const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findOneAndDelete({ _id: req.params.id, branches: req.session.user.branch });
        if (!product) { return res.status(404).send("Product not found or you do not have permission to delete it."); }
        await Size.deleteMany({ productId: product._id });
        await Price.deleteMany({ productId: product._id });
        res.redirect('/admin/products');
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).send('Server error while deleting product.');
    }
};

// --- User Management (Admin Role) ---
const getUserPage = async (req, res) => {
    try {
        const users = await User.find({
            branch: req.session.user.branch,
            _id: { $ne: req.session.user.id },
            role: { $nin: ['Super Admin', 'Assistant Manager'] } // Exclude higher roles
        }).sort({ createdAt: 'desc' });
        res.render('admin/users', { user: req.session.user, users: users, activePage: 'users' });
    } catch (error) {
        console.error("Error fetching Users Page (Admin):", error);
        res.status(500).send("Error fetching Users Page");
    }
};

const getAddUserPage = async (req, res) => {
    try {
        const adminBranch = await Branch.findById(req.session.user.branch);
        res.render('admin/addUser', {
            user: req.session.user, activePage: 'users',
            branchName: adminBranch ? adminBranch.name : 'Unknown Branch',
            errors: null, input: {}
        });
    } catch (error) {
        console.error("Error Getting Add User Page (Admin):", error);
        res.status(500).send("Error Getting Add User Page");
    }
};

const postAddUser = async (req, res) => {
    const { firstName, lastName, contactNumber, password, role } = req.body;
    const branchId = req.session.user.branch;
    try {
        if (['Super Admin', 'Assistant Manager'].includes(role)) { throw new Error('Admins cannot create Super Admin or Assistant Manager roles.'); }
        const username = `${firstName.toLowerCase().replace(/\s/g, '')}.${lastName.toLowerCase().replace(/\s/g, '')}`;
        const newUser = new User({ firstName, lastName, username, contactNumber, password, role, branch: branchId });
        await newUser.save();
        res.redirect('/admin/users');
    } catch (error) {
        const adminBranch = await Branch.findById(req.session.user.branch);
        let errors = [];
        if (error.code === 11000) { if (error.keyPattern && error.keyPattern.contactNumber) { errors.push('Contact number already exists.'); } else { errors.push('A unique field already exists.'); } }
        else if (error.name === 'ValidationError') { for (let field in error.errors) { errors.push(error.errors[field].message); } }
        else { console.error('Unexpected error creating user (Admin):', error); errors.push(error.message || 'An unexpected error occurred.'); }
        res.status(400).render('admin/addUser', {
            user: req.session.user, activePage: 'users',
            branchName: adminBranch ? adminBranch.name : 'Unknown Branch',
            errors: errors, input: req.body
        });
    }
};

const getUserEditPage = async (req, res) => {
    try {
        const userDetails = await User.findOne({ _id: req.params.id, branch: req.session.user.branch })
                                       .populate('branch', 'name');
        if (!userDetails) { return res.status(404).send("User not found or you do not have permission to edit this user."); }
        if (['Super Admin', 'Assistant Manager'].includes(userDetails.role)) { return res.status(403).send("Admins cannot edit Super Admin or Assistant Manager users."); }
        res.render('admin/editUser', {
            user: req.session.user, user_details: userDetails, activePage: 'users',
            errors: null, input: null
        });
    } catch (error) {
        console.error("Error getting edit user page (Admin):", error);
        return res.status(500).send("Error getting edit user page");
    }
};

const postUserEdit = async (req, res) => {
    const userId = req.params.id;
    const adminBranchId = req.session.user.branch;
    try {
        const { firstName, lastName, role } = req.body;
        if (!firstName || !lastName || !role) { throw new Error('Missing required fields (First Name, Last Name, Role).'); }
        if (['Super Admin', 'Assistant Manager'].includes(role)) { throw new Error('Admins cannot assign Super Admin or Assistant Manager roles.'); }
        const userToUpdate = await User.findOne({ _id: userId, branch: adminBranchId });
        if (!userToUpdate) { return res.status(404).send("User not found or you do not have permission to edit this user."); }
        if (['Super Admin', 'Assistant Manager'].includes(userToUpdate.role)) { return res.status(403).send("Admins cannot edit Super Admin or Assistant Manager users."); }
        const updateData = { firstName, lastName, role };
        await User.findByIdAndUpdate(userId, updateData, { new: true, runValidators: true });
        res.redirect('/admin/users');
    } catch (error) {
        console.error('Error updating user (Admin):', error);
        try {
            const userDetails = await User.findOne({ _id: userId, branch: adminBranchId }).populate('branch', 'name');
             if (!userDetails) { return res.status(404).send("User not found."); }
             let errors = [];
             if (error.name === 'ValidationError') { for (let field in error.errors) { errors.push(error.errors[field].message); } }
             else { errors.push(error.message || 'An unexpected error occurred.'); }
             return res.status(400).render('admin/editUser', {
                 user: req.session.user, user_details: userDetails, activePage: 'users',
                 errors: errors, input: req.body
             });
        } catch (renderError) {
             console.error('Error re-rendering edit user page after update failure:', renderError);
             return res.status(500).send('Server Error during user update.');
        }
    }
};

const postUserDelete = async (req, res) => {
    try {
        const userIdToDelete = req.params.id;
        const adminBranchId = req.session.user.branch;
        const userToDelete = await User.findOne({ _id: userIdToDelete, branch: adminBranchId, role: { $nin: ['Super Admin', 'Assistant Manager'] } });
        if (!userToDelete) { return res.status(404).send("User not found, does not belong to your branch, or cannot be deleted by an Admin."); }
        if (String(userToDelete._id) === String(req.session.user.id)) { return res.status(403).send("You cannot delete your own account."); }
        await User.findByIdAndDelete(userIdToDelete);
        res.redirect('/admin/users');
    } catch (error) {
        console.error("Error deleting user (Admin):", error);
        return res.status(500).send("Error deleting user");
    }
};


// --- Category Management ---
const getCategories = async (req, res) => {
    try {
        const categories = await Category.find();
        res.render('./admin/categories', {
            user: req.session.user, categories: categories, activePage: 'categories',
            showDeleteErrorModal: false, errorMessage: null // Pass modal flags
        });
    } catch (error) {
         const categories = [];
         res.status(500).render('./admin/categories', {
             user: req.session.user, categories: categories, activePage: 'categories',
             showDeleteErrorModal: true, errorMessage: 'Error fetching categories.'
         });
    }
};

const getAddCategoryPage = async (req, res) => {
    try {
        res.render('./admin/addCategory', { user: req.session.user, activePage: 'categories', errors: null, input: {} });
    } catch (error) {
        res.status(500).send("Error Getting Add Category Page");
    }
};

const getEditCategoryPage = async (req, res) => {
    try {
        const category_details = await Category.findById(req.params.id);
        if(!category_details) return res.status(404).send("Category not found");
        res.render('./admin/editCategory', { user: req.session.user, category_details: category_details, activePage: 'categories', errors: null, input: null });
    } catch (error) {
        res.status(500).send("Error Getting Edit Category Page");
    }
};

const postAddCategory = async (req, res) => {
    try {
        const { name } = req.body;
        if(!name || name.trim().length === 0) throw new Error("Category name required.");
        const existingCategory = await Category.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
        if (existingCategory) { throw new Error(`Category "${existingCategory.name}" already exists.`); }
        await Category.create({ name: name.trim() });
        res.redirect('/admin/categories');
    } catch (error) {
        res.status(400).render('./admin/addCategory', { user: req.session.user, activePage: 'categories', errors: [error.message || 'Failed to add category'], input: req.body });
    }
};

const postEditCategory = async (req, res) => {
     const categoryId = req.params.id;
    try {
        const { name } = req.body;
        if(!name || name.trim().length === 0) throw new Error("Category name required.");
        const existingCategory = await Category.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }, _id: { $ne: categoryId } });
        if (existingCategory) { throw new Error(`Another category named "${existingCategory.name}" already exists.`); }
        await Category.findByIdAndUpdate(categoryId, { name: name.trim() }, {runValidators: true});
        res.redirect('/admin/categories');
    } catch (error) {
        const category_details = await Category.findById(categoryId);
        res.status(400).render('./admin/editCategory', { user: req.session.user, category_details: category_details, activePage: 'categories', errors: [error.message || 'Failed to edit category'], input: req.body });
    }
};

const postDeletedCategory = async (req, res) => {
    const categoryId = req.params.id;
    let categoryName = 'this category';
    try {
        const category = await Category.findById(categoryId);
        if (category) { categoryName = category.name; }
        else {
             const categories = await Category.find();
             return res.status(404).render('admin/categories', { user: req.session.user, categories: categories, activePage: 'categories', showDeleteErrorModal: true, errorMessage: 'Category not found.' });
        }
        const productCount = await Product.countDocuments({ category: categoryId, branches: req.session.user.branch });
        if (productCount > 0) {
            console.warn(`Admin ${req.session.user.id} attempted to delete category '${categoryName}' (${categoryId}) which has ${productCount} products assigned in their branch.`);
            const categories = await Category.find();
            return res.status(400).render('admin/categories', {
                 user: req.session.user, categories: categories, activePage: 'categories',
                 showDeleteErrorModal: true,
                 errorMessage: `Cannot delete category '${categoryName}': ${productCount} product(s) in your branch are assigned to it.`
             });
        }
        await Category.findByIdAndDelete(categoryId);
        res.redirect('/admin/categories');
    } catch (error) {
        console.error("Error Deleting Category (Admin):", error);
         const categories = await Category.find();
         res.status(500).render('admin/categories', {
             user: req.session.user, categories: categories, activePage: 'categories',
             showDeleteErrorModal: true, errorMessage: `Server error while attempting to delete '${categoryName}'.`
         });
    }
};

// --- Variant/Size Management ---
const deleteSize = async (req, res) => {
    try {
        const sizeId = req.params.id;
        const sizeToDelete = await Size.findById(sizeId);
        if (!sizeToDelete) { return res.status(404).send("Size not found"); }
        const parentProduct = await Product.findOne({ _id: sizeToDelete.productId, branches: req.session.user.branch });
        if (!parentProduct) { return res.status(403).send("You do not have permission to modify this product's variants."); }
        await Price.updateMany({ productId: sizeToDelete.productId, sizeId: sizeId, status: 'Active' }, { status: 'Inactive' });
        await Size.findByIdAndUpdate(sizeId, { status: 'Inactive' }); // Mark as inactive
        res.redirect(`/admin/products/edit/${sizeToDelete.productId}`);
    } catch (error) {
        console.error('Error deleting/inactivating size:', error);
        res.status(500).send('Server error while deleting size.');
    }
};

module.exports = {
    getAnalyticsPage, getProducts, getAddProductPage, postAddProduct, getEditProductPage, postUpdateProduct,
    deleteProduct, getUserPage, getAddUserPage, postAddUser, getUserEditPage, postUserEdit, postUserDelete,
    getCategories, getAddCategoryPage, getEditCategoryPage, postAddCategory, postEditCategory, postDeletedCategory,
    getOrdersPage, getOrdersData, renderOrdersList, getOrdersCount, exportOrders, deleteSize, updateOrderStatus
};