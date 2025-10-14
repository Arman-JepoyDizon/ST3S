// File: controllers/superAdminController.js

const Branch = require('../models/branch');
const Transaction = require('../models/transaction');
const Product = require('../models/product');
const User = require('../models/user');
const Category = require('../models/category');
const Price = require('../models/price');
const Size = require('../models/size');
const mongoose = require('mongoose');

const getDashboardPage = async (req, res) => {
    try {
        const totalSalesData = await Transaction.aggregate([
            { $match: { status: 'Completed' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        const totalSales = totalSalesData.length > 0 ? totalSalesData[0].total : 0;
        const totalOrders = await Transaction.countDocuments();
        const activeBranchesCount = await Branch.countDocuments({ status: 'Active' });
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        const monthlySalesData = await Transaction.aggregate([
            { $match: { status: 'Completed', createdAt: { $gte: startOfMonth, $lte: endOfMonth } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        const salesThisMonth = monthlySalesData.length > 0 ? monthlySalesData[0].total : 0;
        const branches = await Branch.find({}).sort({ name: 1 });
        const branchStats = await Promise.all(branches.map(async (branch) => {
            const salesData = await Transaction.aggregate([
                { $match: { branch: branch._id, status: 'Completed' } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]);
            const sales = salesData.length > 0 ? salesData[0].total : 0;
            const orders = await Transaction.countDocuments({ branch: branch._id });
            const products = await Product.countDocuments({ branches: branch._id });
            const staff = await User.countDocuments({ branch: branch._id });
            return { ...branch.toObject(), sales, orders, products, staff };
        }));
        res.render('superadmin/dashboard', {
            user: req.session.user, totalSales, totalOrders, activeBranchesCount, salesThisMonth, branchStats, activePage: 'dashboard'
        });
    } catch (error) {
        console.error('Error fetching Super Admin dashboard data:', error);
        res.status(500).send('Server Error');
    }
};

const getBranchesPage = async (req, res) => {
    try {
        const branches = await Branch.find({}).sort({ name: 1 });
        res.render('superadmin/branches', { user: req.session.user, branches: branches, activePage: 'branches' });
    } catch (error) {
        console.error('Error fetching branches page:', error);
        res.status(500).send('Server Error');
    }
};

const getAddBranchPage = (req, res) => {
    res.render('superadmin/addBranch', { user: req.session.user, activePage: 'branches' });
};

const postAddBranch = async (req, res) => {
    try {
        const { name, location, contact } = req.body;
        if (!name || !location) { return res.status(400).send('Branch name and location are required.'); }
        await Branch.create({ name, location, contact });
        res.redirect('/superadmin/branches');
    } catch (error) {
        console.error('Error adding branch:', error);
        res.status(500).send('Server Error');
    }
};

const getEditBranchPage = async (req, res) => {
    try {
        const branch = await Branch.findById(req.params.id);
        if (!branch) { return res.status(404).send('Branch not found'); }
        res.render('superadmin/editBranch', { user: req.session.user, branch: branch, activePage: 'branches' });
    } catch (error) {
        console.error('Error fetching branch for edit:', error);
        res.status(500).send('Server Error');
    }
};

const postEditBranch = async (req, res) => {
    try {
        const { name, location, contact, status } = req.body;
        if (!name || !location) { return res.status(400).send('Branch name and location are required.'); }
        await Branch.findByIdAndUpdate(req.params.id, { name, location, contact, status });
        res.redirect('/superadmin/branches');
    } catch (error) {
        console.error('Error updating branch:', error);
        res.status(500).send('Server Error');
    }
};

const postDeleteBranch = async (req, res) => {
    try {
        await Branch.findByIdAndDelete(req.params.id);
        res.redirect('/superadmin/branches');
    } catch (error) {
        console.error('Error deleting branch:', error);
        res.status(500).send('Server Error');
    }
};

const getProductsPage = async (req, res) => {
    try {
        const { search, branch } = req.query;
        let filterQuery = {};
        if (search) { filterQuery.name = { $regex: search, $options: 'i' }; }
        if (branch) { filterQuery.branches = branch; }
        const allBranches = await Branch.find({ status: 'Active' });
        const products = await Product.find(filterQuery).populate('category');
        res.render('superadmin/products', { user: req.session.user, products, branches: allBranches, query: req.query, activePage: 'products' });
    } catch (error) {
        console.error('Error fetching super admin products page:', error);
        res.status(500).send('Server Error');
    }
};

const getAddProductPage = async (req, res) => {
    try {
        const categories = await Category.find({});
        const branches = await Branch.find({ status: 'Active' });
        res.render('superadmin/addProduct', { user: req.session.user, categories, branches, activePage: 'products' });
    } catch (error) {
        console.error('Error getting add product page for super admin:', error);
        res.status(500).send('Server Error');
    }
};

const postAddProduct = async (req, res) => {
    try {
        const { name, price, size, category, imageUrl, branches } = req.body;
        const prices = Array.isArray(price) ? price : [price];
        let sizes = Array.isArray(size) ? (size || []).filter(s => s && s.trim() !== '') : [];
        if (!name || !prices[0] || !category || !branches) { return res.status(400).send('Missing required fields.'); }
        const lowestPrice = Math.min(...prices.map(p => parseFloat(p)));
        const newProduct = await Product.create({ name, price: lowestPrice, category, imageUrl, branches });
        if (sizes.length > 0) {
            let newSizes = [];
            for (let i = 0; i < sizes.length; i++) {
                const insertedSize = await Size.create({ productId: newProduct._id, label: sizes[i] });
                newSizes.push(insertedSize);
            }
            for (let i = 0; i < prices.length; i++) {
                await Price.create({ productId: newProduct._id, sizeId: newSizes[i]?._id, price: prices[i] });
            }
        } else {
            await Price.create({ productId: newProduct._id, price: prices[0] });
        }
        res.redirect('/superadmin/products');
    } catch (error) {
        console.error('Error adding product by super admin:', error);
        res.status(500).send('Server error');
    }
};

const getEditProductPage = async (req, res) => {
     try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).send('Product not found');
        const allBranches = await Branch.find({ status: 'Active' });
        const allCategories = await Category.find({});
        const sizes = await Size.find({ productId: req.params.id, status: 'Active' });
        const prices = await Price.find({ productId: req.params.id, status: 'Active' });
        res.render('superadmin/editProduct', { user: req.session.user, product, branches: allBranches, categories: allCategories, sizes, prices, activePage: 'products' });
    } catch (error) {
        console.error('Error fetching product for edit (super admin):', error);
        res.status(500).send('Server error.');
    }
};

const postUpdateProduct = async (req, res) => {
    try {
        const { name, price, category, imageUrl, branches } = req.body;
        const prices = Array.isArray(price) ? price : [price];
        const lowestPrice = Math.min(...prices.map(p => parseFloat(p)));
        await Product.findByIdAndUpdate(req.params.id, { name, price: lowestPrice, category, imageUrl, branches });
        res.redirect('/superadmin/products');
    } catch (error) {
        console.error('Error updating product (super admin):', error);
        res.status(500).send('Server Error');
    }
};

const postDeleteProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        await Product.findByIdAndDelete(productId);
        await Size.deleteMany({ productId });
        await Price.deleteMany({ productId });
        res.redirect('/superadmin/products');
    } catch (error) {
        console.error('Error deleting product (super admin):', error);
        res.status(500).send('Server Error');
    }
};

const getUsersPage = async (req, res) => {
    try {
        const { search, branch } = req.query;
        let filterQuery = { _id: { $ne: req.session.user.id } };
        if (search) { filterQuery.username = { $regex: search, $options: 'i' }; }
        if (branch) { filterQuery.branch = branch; }
        const allBranches = await Branch.find({ status: 'Active' });
        const users = await User.find(filterQuery).populate('branch').sort({ createdAt: -1 });
        res.render('superadmin/users', { user: req.session.user, users, branches: allBranches, query: req.query, activePage: 'users' });
    } catch (error) {
        console.error('Error fetching super admin users page:', error);
        res.status(500).send('Server Error');
    }
};

const getAddUserPage = async (req, res) => {
    try {
        const branches = await Branch.find({ status: 'Active' });
        res.render('superadmin/addUser', { user: req.session.user, branches, activePage: 'users' });
    } catch (error) {
        console.error('Error getting add user page for super admin:', error);
        res.status(500).send('Server Error');
    }
};

const postAddUser = async (req, res) => {
    try {
        const { username, password, role, branch } = req.body;
        if (!username || !password || !role) { return res.status(400).send('Username, password, and role are required.'); }
        if (role !== 'Super Admin' && !branch) { return res.status(400).send('A branch assignment is required for this user role.'); }
        await User.create({ username, password, role, branch });
        res.redirect('/superadmin/users');
    } catch (error) {
        console.error('Error adding user (super admin):', error);
        res.status(500).send('Server Error');
    }
};

const getEditUserPage = async (req, res) => {
    try {
        const userToEdit = await User.findById(req.params.id);
        if (!userToEdit) return res.status(404).send('User not found.');
        const branches = await Branch.find({ status: 'Active' });
        res.render('superadmin/editUser', { user: req.session.user, userToEdit, branches, activePage: 'users' });
    } catch (error) {
        console.error('Error fetching user for edit (super admin):', error);
        res.status(500).send('Server Error');
    }
};

const postUpdateUser = async (req, res) => {
    try {
        const { username, role, branch } = req.body;
        const updateData = { username, role, branch: role === 'Super Admin' ? null : branch };
        await User.findByIdAndUpdate(req.params.id, updateData);
        res.redirect('/superadmin/users');
    } catch (error) {
        console.error('Error updating user (super admin):', error);
        res.status(500).send('Server Error');
    }
};

const postDeleteUser = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.redirect('/superadmin/users');
    } catch (error) {
        console.error('Error deleting user (super admin):', error);
        res.status(500).send('Server Error');
    }
};

const getAnalyticsPage = async (req, res) => {
    try {
        const { filter, dateRange, branch } = req.query;
        let startDate = new Date();
        let endDate = new Date();
        let currentFilter = filter || 'week';
        
        endDate.setHours(23, 59, 59, 999);

        if (dateRange) {
            const [startDateStr, endDateStr] = dateRange.split(' to ');
            startDate = new Date(startDateStr);
            startDate.setHours(0, 0, 0, 0);
            endDate = endDateStr ? new Date(endDateStr) : new Date(startDate);
            endDate.setHours(23, 59, 59, 999);
            currentFilter = 'custom';
        } else {
            switch (currentFilter) {
                case 'today': startDate.setHours(0, 0, 0, 0); break;
                case 'month': startDate.setDate(1); startDate.setHours(0, 0, 0, 0); break;
                case 'year': startDate.setMonth(0, 1); startDate.setHours(0, 0, 0, 0); break;
                case 'week': default: startDate.setDate(startDate.getDate() - startDate.getDay()); startDate.setHours(0, 0, 0, 0); currentFilter = 'week'; break;
            }
        }
        
        let matchQuery = { createdAt: { $gte: startDate, $lte: endDate } };
        // Fixed: Check for a valid, non-empty branch string before creating ObjectId
        if (branch && branch.trim() !== '') {
            matchQuery.branch = new mongoose.Types.ObjectId(branch);
        }

        const totalOrders = await Transaction.countDocuments(matchQuery);
        const salesData = await Transaction.aggregate([
            { $match: { ...matchQuery, status: 'Completed' } },
            { $group: { _id: null, totalSales: { $sum: '$totalAmount' } } }
        ]);
        const totalSales = salesData.length > 0 ? salesData[0].totalSales : 0;
        
        const bestSellers = await Transaction.aggregate([
            { $match: { ...matchQuery, status: 'Completed' } },
            { $unwind: '$items' },
            { $group: { _id: { productId: '$items.productId', sizeLabel: '$items.sizeLabel' }, totalQuantity: { $sum: '$items.quantity' } } },
            { $sort: { totalQuantity: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'products', localField: '_id.productId', foreignField: '_id', as: 'productDetails' } },
            { $unwind: '$productDetails' }
        ]);
        
        const topProductsData = {
            labels: bestSellers.map(p => `${p.productDetails.name}${p._id.sizeLabel ? ` - ${p._id.sizeLabel}` : ''}`),
            data: bestSellers.map(p => p.totalQuantity)
        };
        
        const dailySales = await Transaction.aggregate([
            { $match: { ...matchQuery, status: 'Completed' } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Manila" } }, dailyTotal: { $sum: "$totalAmount" } } },
            { $sort: { _id: 1 } }
        ]);

        const salesMap = new Map(dailySales.map(d => [d._id, d.dailyTotal]));
        const labels = [];
        const data = [];
        const formatDateToYYYYMMDD = (date) => { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; };
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateString = formatDateToYYYYMMDD(new Date(d));
            labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            data.push(salesMap.get(dateString) || 0);
        }
        const salesTrendData = { labels, data, title: 'Sales Trend' };
        
        const allBranches = await Branch.find({ status: 'Active' });

        res.render('superadmin/analytics', {
            user: req.session.user, totalSales, totalOrders, salesTrendData, topProductsData,
            branches: allBranches, query: req.query, currentFilter, activePage: 'analytics'
        });
    } catch (error) {
        console.error('Error fetching analytics data:', error);
        res.status(500).send('Server Error');
    }
};

const getAnalyticsData = async (req, res) => {
    try {
        const { filter, dateRange, branch } = req.query;
        let startDate = new Date();
        let endDate = new Date();
        let currentFilter = filter || 'week';
        
        endDate.setHours(23, 59, 59, 999);

        if (dateRange) {
            const [startDateStr, endDateStr] = dateRange.split(' to ');
            startDate = new Date(startDateStr); startDate.setHours(0, 0, 0, 0);
            endDate = endDateStr ? new Date(endDateStr) : new Date(startDate); endDate.setHours(23, 59, 59, 999);
            currentFilter = 'custom';
        } else {
            switch (currentFilter) {
                case 'today': startDate.setHours(0, 0, 0, 0); break;
                case 'month': startDate.setDate(1); startDate.setHours(0, 0, 0, 0); break;
                case 'year': startDate.setMonth(0, 1); startDate.setHours(0, 0, 0, 0); break;
                case 'week': default: startDate.setDate(startDate.getDate() - startDate.getDay()); startDate.setHours(0, 0, 0, 0); currentFilter = 'week'; break;
            }
        }
        
        let matchQuery = { createdAt: { $gte: startDate, $lte: endDate } };
        // Fixed: Check for a valid, non-empty branch string before creating ObjectId
        if (branch && branch.trim() !== '') {
            matchQuery.branch = new mongoose.Types.ObjectId(branch);
        }

        const totalOrders = await Transaction.countDocuments(matchQuery);
        const salesData = await Transaction.aggregate([
            { $match: { ...matchQuery, status: 'Completed' } },
            { $group: { _id: null, totalSales: { $sum: '$totalAmount' } } }
        ]);
        const totalSales = salesData.length > 0 ? salesData[0].totalSales : 0;
        
        const bestSellers = await Transaction.aggregate([
            { $match: { ...matchQuery, status: 'Completed' } },
            { $unwind: '$items' },
            { $group: { _id: { productId: '$items.productId', sizeLabel: '$items.sizeLabel' }, totalQuantity: { $sum: '$items.quantity' } } },
            { $sort: { totalQuantity: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'products', localField: '_id.productId', foreignField: '_id', as: 'productDetails' } },
            { $unwind: '$productDetails' }
        ]);
        
        const topProductsData = {
            labels: bestSellers.map(p => `${p.productDetails.name}${p._id.sizeLabel ? ` - ${p._id.sizeLabel}` : ''}`),
            data: bestSellers.map(p => p.totalQuantity)
        };
        
        const dailySales = await Transaction.aggregate([
            { $match: { ...matchQuery, status: 'Completed' } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Manila" } }, dailyTotal: { $sum: "$totalAmount" } } },
            { $sort: { _id: 1 } }
        ]);

        const salesMap = new Map(dailySales.map(d => [d._id, d.dailyTotal]));
        const labels = [];
        const data = [];
        const formatDateToYYYYMMDD = (date) => { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; };
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateString = formatDateToYYYYMMDD(new Date(d));
            labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            data.push(salesMap.get(dateString) || 0);
        }
        const salesTrendData = { labels, data, title: 'Sales Trend' };
        
        res.json({ totalSales, totalOrders, salesTrendData, topProductsData });
    } catch (error) {
        console.error('Error fetching analytics API data:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

module.exports = {
    getDashboardPage,
    getBranchesPage,
    getAddBranchPage,
    postAddBranch,
    getEditBranchPage,
    postEditBranch,
    postDeleteBranch,
    getProductsPage,
    getAddProductPage,
    postAddProduct,
    getEditProductPage,
    postUpdateProduct,
    postDeleteProduct,
    getUsersPage,
    getAddUserPage,
    postAddUser,
    getEditUserPage,
    postUpdateUser,
    postDeleteUser,
    getAnalyticsPage,
    getAnalyticsData
};