// File: controllers/adminController.js

const Product = require('../models/product');
const Price = require('../models/price');
const User = require('../models/user');
const Category = require('../models/category');
const Transaction = require('../models/transaction'); 
const Size = require('../models/size');
const Branch = require('../models/branch');
const mongoose = require('mongoose');

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
            { $match: { status: 'Completed', ...matchQuery } },
            { $unwind: '$items' },
            { $group: { _id: { productId: '$items.productId', sizeLabel: '$items.sizeLabel' }, totalQuantity: { $sum: '$items.quantity' }, totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } } } },
            { $sort: { totalRevenue: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'products', localField: '_id.productId', foreignField: '_id', as: 'productDetails' } },
            { $unwind: '$productDetails' }
        ]);
        
        let salesTrendData;
        if (currentFilter === 'year' || (currentFilter === 'custom' && (endDate - startDate) / (1000 * 60 * 60 * 24) > 60)) {
            const monthlySales = await Transaction.aggregate([
                { $match: { status: 'Completed', ...matchQuery } },
                { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Manila" } }, monthlyTotal: { $sum: "$totalAmount" } } },
                { $sort: { _id: 1 } }
            ]);
            const salesMap = new Map(monthlySales.map(d => [d._id, d.monthlyTotal]));
            const labels = []; const data = []; let dateIterator = new Date(startDate);
            while (dateIterator <= endDate) {
                const year = dateIterator.getFullYear();
                const month = String(dateIterator.getMonth() + 1).padStart(2, '0');
                const monthString = `${year}-${month}`; // Format YYYY-MM
                const currentLabel = dateIterator.toLocaleString('en-US', { month: 'short', year: 'numeric' });
                if (!labels.includes(currentLabel)) { 
                    labels.push(currentLabel); 
                    data.push(salesMap.get(monthString) || 0); 
                }
                dateIterator.setMonth(dateIterator.getMonth() + 1);
            }
            salesTrendData = { labels, data, title: 'Sales Trend (Monthly)' };
        } else {
            const title = `Sales Trend (${customDateRange ? `${customDateRange.start} - ${customDateRange.end}` : currentFilter.charAt(0).toUpperCase() + currentFilter.slice(1)})`;
            const dailySales = await Transaction.aggregate([
                { $match: { status: 'Completed', ...matchQuery } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Manila" } }, dailyTotal: { $sum: "$totalAmount" } } },
                { $sort: { _id: 1 } }
            ]);
            const salesMap = new Map(dailySales.map(d => [d._id, d.dailyTotal]));
            const labels = []; const data = []; let dateIterator = new Date(startDate);
            
            // Helper function to format date consistently
            const formatDateToYYYYMMDD = (date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            while (dateIterator <= endDate) {
                // Fixed: Format the date key without converting to UTC
                const dateString = formatDateToYYYYMMDD(dateIterator);
                labels.push(dateIterator.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
                data.push(salesMap.get(dateString) || 0);
                dateIterator.setDate(dateIterator.getDate() + 1);
            }
            salesTrendData = { labels, data, title };
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

const getOrdersPage = async (req, res) => {
    try {
        const { search, dateRange, status } = req.query;
        let filterQuery = { branch: req.session.user.branch };
        if (search) {
            filterQuery.$expr = { $regexMatch: { input: { $substr: [{ $toString: "$_id" }, -6, 6] }, regex: new RegExp(search, 'i') } };
        }
        if (dateRange) {
            const [startDateStr, endDateStr] = dateRange.split(' to ');
            const startDate = new Date(startDateStr); startDate.setHours(0, 0, 0, 0);
            const endDate = endDateStr ? new Date(endDateStr) : new Date(startDate); endDate.setHours(23, 59, 59, 999);
            filterQuery.createdAt = { $gte: startDate, $lte: endDate };
        }
        if (status) { filterQuery.status = status; }
        const totalTransactionsCount = await Transaction.countDocuments({ branch: req.session.user.branch });
        const transactions = await Transaction.find(filterQuery).sort({ createdAt: -1 }).populate('createdBy', 'username').populate('items.productId', 'name');
        res.render('admin/orders', { user: req.session.user, transactions, totalTransactionsCount, query: req.query, activePage: 'orders' });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Server Error');
    }
};

const getOrdersCount = async (req, res) => {
    try {
        const { dateRange, status } = req.query;
        let filterQuery = { branch: req.session.user.branch };
        if (dateRange) {
            const [startDateStr, endDateStr] = dateRange.split(' to ');
            const startDate = new Date(startDateStr); startDate.setHours(0, 0, 0, 0);
            const endDate = endDateStr ? new Date(endDateStr) : new Date(startDate); endDate.setHours(23, 59, 59, 999);
            filterQuery.createdAt = { $gte: startDate, $lte: endDate };
        }
        if (status) { filterQuery.status = status; }
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
        if (dateRange) {
            const [startDateStr, endDateStr] = dateRange.split(' to ');
            const startDate = new Date(startDateStr); startDate.setHours(0, 0, 0, 0);
            const endDate = endDateStr ? new Date(endDateStr) : new Date(startDate); endDate.setHours(23, 59, 59, 999);
            filterQuery.createdAt = { $gte: startDate, $lte: endDate };
        }
        if (status) { filterQuery.status = status; }
        const transactions = await Transaction.find(filterQuery).sort({ createdAt: -1 }).populate('createdBy', 'username').populate('items.productId', 'name');
        const exportFields = Array.isArray(fields) ? fields : (fields ? [fields] : []);
        if (exportFields.length === 0) { return res.status(400).send('No fields selected for export.'); }
        const headerMap = { orderId: 'Order Number', date: 'Date', time: 'Time', items: 'Item Details', status: 'Status', totalAmount: 'Total Amount', createdBy: 'Created By', paymentMethod: 'Payment Method', customerName: 'Customer Name', discount: 'Discount Details' };
        const csvHeaders = exportFields.map(field => headerMap[field] || field);
        const sanitizeField = (field) => { if (field == null) return ''; const str = String(field); if (str.includes(',') || str.includes('"') || str.includes('\n')) { return `"${str.replace(/"/g, '""')}"`; } return str; };
        const csvRows = transactions.map(t => { const row = { orderId: `ORD-${t._id.toString().slice(-6).toUpperCase()}`, date: new Date(t.createdAt).toLocaleDateString('en-CA'), time: new Date(t.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }), items: t.items.map(item => `${item.quantity}x ${item.productId ? item.productId.name : 'N/A'}${item.sizeLabel ? ` (${item.sizeLabel})` : ''}`).join('; '), status: t.status, totalAmount: t.totalAmount.toFixed(2), createdBy: t.createdBy ? t.createdBy.username : 'N/A', paymentMethod: t.paymentMethod, customerName: t.customerName || '', discount: t.discountApplied ? `Yes (-${t.discountAmount.toFixed(2)})` : 'No', }; return exportFields.map(field => sanitizeField(row[field])).join(','); });
        const csvString = [csvHeaders.join(','), ...csvRows].join('\n');
        const fileName = `Miras-Transactions-${new Date().toISOString().slice(0,10)}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.status(200).send(csvString);
    } catch (error) {
        console.error('Error exporting orders:', error);
        res.status(500).send('Server Error during export.');
    }
};

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
    } catch(error) {
        console.error('Error getting add product page:', error);
        res.status(500).send('Server error.');
    }
};

const postAddProduct = async (req, res) => {
    try {
        const { name, price, size, category, imageUrl } = req.body;
        const prices = Array.isArray(price) ? price : [price];
        let sizes = Array.isArray(size) ? (size || []).filter(s => s && s.trim() !== '') : [];
        if(!name || !prices[0] || !category) { return res.status(400).send("Missing required fields."); }
        const lowestPrice = Math.min(...prices.map(p => parseFloat(p)));
        const newProduct = await Product.create({ name, price: lowestPrice, category, imageUrl, branches: [req.session.user.branch] });
        if(sizes.length > 0){
            for(let i = 0; i < sizes.length; i++){
                const insertedSize = await Size.create({productId: newProduct._id, label: sizes[i]});
                await Price.create({productId: newProduct._id, sizeId: insertedSize._id, price: prices[i]});
            }
        } else {
            await Price.create({ productId: newProduct._id, price: prices[0] });
        }
        res.redirect('/admin/products');
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).send('Server error while adding product.');
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
        if (!productToUpdate) {
            return res.status(403).send("You do not have permission to edit this product.");
        }

        const prices = Array.isArray(price) ? price : [price];
        let sizes = Array.isArray(size) ? (size || []).filter(s => s && s.trim() !== '') : [];
        if (!name || !prices[0] || !category) { return res.status(400).send("Missing required fields."); }

        const lowestPrice = Math.min(...prices.map(p => parseFloat(p)));
        const existingSizes = await Size.find({ productId });
        
        if (existingSizes.length > 0 && sizes.length === 0) {
            await Price.updateMany({ productId }, { status: "Inactive" });
            await Size.deleteMany({ productId });
            await Price.create({ productId, price: prices[0], status: "Active" });
        } 
        else if (existingSizes.length === 0 && sizes.length > 0) {
            await Price.updateMany({ productId, sizeId: null }, { status: "Inactive" });
            for (let i = 0; i < sizes.length; i++) {
                const newSize = await Size.create({ productId, label: sizes[i].trim() });
                await Price.create({ productId, sizeId: newSize._id, price: parseFloat(prices[i] || prices[0]), status: "Active" });
            }
        }
        else if (sizes.length > 0) {
            const keepSizeIds = new Set();
            for (let i = 0; i < sizes.length; i++) {
                const newLabel = String(sizes[i]).trim();
                const newPrice = parseFloat(prices[i] || prices[0]);
                let sizeDoc = existingSizes.find(s => s.label.toLowerCase() === newLabel.toLowerCase());
                if (sizeDoc) {
                    await Size.findByIdAndUpdate(sizeDoc._id, { status: "Active" });
                    const currentPrice = await Price.findOne({ productId, sizeId: sizeDoc._id, status: "Active" });
                    if (!currentPrice || currentPrice.price !== newPrice) {
                        if (currentPrice) await Price.findByIdAndUpdate(currentPrice._id, { status: "Inactive" });
                        await Price.create({ productId, sizeId: sizeDoc._id, price: newPrice, status: "Active" });
                    }
                } else {
                    sizeDoc = await Size.create({ productId, label: newLabel });
                    await Price.create({ productId, sizeId: sizeDoc._id, price: newPrice, status: "Active" });
                }
                keepSizeIds.add(String(sizeDoc._id));
            }
            const toDeactivate = existingSizes.filter(s => !keepSizeIds.has(String(s._id)));
            for (const s of toDeactivate) {
                await Size.findByIdAndUpdate(s._id, { status: "Inactive" });
                await Price.updateMany({ productId, sizeId: s._id, status: "Active" }, { status: "Inactive" });
            }
        } 
        else {
            const currentPrice = await Price.findOne({ productId, sizeId: null, status: 'Active' });
            if (!currentPrice || currentPrice.price !== parseFloat(prices[0])) {
                if (currentPrice) await Price.findByIdAndUpdate(currentPrice._id, { status: 'Inactive' });
                await Price.create({ productId, price: prices[0], status: 'Active' });
            }
        }
        
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

const getUserPage = async (req, res) => {
    try{
        const users = await User.find({ 
            branch: req.session.user.branch,
            _id: { $ne: req.session.user.id }
        }).sort({createdAt: 'desc'});
        res.render('admin/users',{user: req.session.user, users: users, activePage: 'users'});
    }catch(error){
        console.error(error);
        res.status(500).send("Error fetching Users Page");
    }
};

const getAddUserPage = async (req, res) => {
    try{
        const adminBranch = await Branch.findById(req.session.user.branch);
        res.render('admin/addUser',{ user:req.session.user, activePage: 'users', branchName: adminBranch ? adminBranch.name : 'Unknown Branch' });
    }catch(error){
        console.error(error);
        res.status(500).send("Error Getting Add User Page");
    }
};

const postAddUser = async (req, res) => {
    try{
        const {username, password, passwordRepeat, role} = req.body;
        const branchId = req.session.user.branch;
        const existingUser = await User.findOne({username: username});
        if(!username || !password || !passwordRepeat || !role){ return res.status(400).send("Missing required fields."); }
        if(existingUser){ return res.status(400).send("Username already exists."); }
        if(password != passwordRepeat){ return res.status(400).send("Passwords do not match."); }
        const newUser = await User.create({ username, role, password, branch: branchId });
        if(!newUser){ return res.status(500).send("Error Creating User"); }
        res.redirect('/admin/users');
    }catch(error){
        console.error(error);
        return res.status(500).send("Error creating user.");
    }
};

const getUserEditPage = async (req, res) => {
    try{
        const userDetails = await User.findOne({ _id: req.params.id, branch: req.session.user.branch });
        if(!userDetails){ return res.status(404).send("User not found or you do not have permission to edit this user."); }
        res.render('admin/editUser', {user: req.session.user, user_details: userDetails, activePage: 'users'});
    }catch(error){
        console.error(error);
        return res.status(500).send("Error getting edit user page");
    }
};

const postUserEdit = async (req, res)=>{
    try{
        const {username, role} = req.body;
        if(!username || !role){ return res.status(400).send("Missing required fields."); }
        const updatedUser = await User.findOneAndUpdate({ _id: req.params.id, branch: req.session.user.branch }, {username, role});
        if(!updatedUser){ return res.status(404).send("User not found or you do not have permission to edit this user."); }
        res.redirect('/admin/users');
    }catch(error){
        console.error(error);
        return res.status(500).send("Error Updating User");
    }
};

const postUserDelete = async (req, res) => {
    try{
        const deletedUser = await User.findOneAndDelete({ _id: req.params.id, branch: req.session.user.branch });
        if(!deletedUser){ return res.status(404).send("User not found or you do not have permission to delete this user."); }
        res.redirect('/admin/users');
    }catch(error){
        console.error(error);
        return res.status(500).send("Error deleting user");
    }
};

const getCategories = async (req, res) => {
    try{
        const categories = await Category.find()
        res.render('./admin/categories',{user: req.session.user, categories: categories, activePage: 'categories'})
    }catch(error){
        res.status(500).send("Error Getting Categories")
    }
}

const getAddCategoryPage = async (req, res) => {
    try{
        res.render('./admin/addCategory',{user: req.session.user, activePage: 'categories'})
    }catch(error){
        res.status(500).send("Error Getting Add Category Page")
    }
}

const getEditCategoryPage = async (req, res) => {
    try{
        const category_details = await Category.findById(req.params.id)
        res.render('./admin/editCategory',{user: req.session.user, category_details: category_details, activePage: 'categories'})
    }catch(error){
        res.status(500).send("Error Getting Edit Category Page")
    }
}

const postAddCategory = async (req, res) => {
    try{
        const {name} = req.body
        const newCategory = await Category.create({name})
        if(!newCategory){ return res.status(500).send("Error Creating Category"); }
        res.redirect('/admin/categories')
    }catch(error){
        res.status(500).send("Error Adding Category")
    }
}

const postEditCategory = async (req, res) => {
    try{
        const {name} = req.body
        const updatedCategory = await Category.findByIdAndUpdate(req.params.id, {name})
        if(!updatedCategory){ return res.status(500).send("Error Updating Category"); }
        res.redirect('/admin/categories')
    }catch(error){
        res.status(500).send("Error Editing Category")
    }
}

const postDeletedCategory = async (req, res) => {
    try{
        const deletedCategory = await Category.findByIdAndDelete(req.params.id)
        if(!deletedCategory){ return res.status(500).send("Error Deleting Category"); }
        res.redirect('/admin/categories')
    }catch(error){
        res.status(500).send("Error Deleting Category")
    }
}

const deleteSize = async (req, res) => {
    try {
        const sizeId = req.params.id;
        const sizeToDelete = await Size.findById(sizeId);
        if (!sizeToDelete) { return res.status(404).send("Size not found"); }
        const parentProduct = await Product.findOne({ _id: sizeToDelete.productId, branches: req.session.user.branch });
        if (!parentProduct) { return res.status(403).send("You do not have permission to modify this product's variants."); }
        await Price.updateMany({ sizeId: sizeId }, { status: 'Inactive' });
        await Size.findByIdAndDelete(sizeId);
        res.redirect(`/admin/products/edit/${sizeToDelete.productId}`);
    } catch (error) {
        console.error('Error deleting size:', error);
        res.status(500).send('Server error while deleting size.');
    }
};

module.exports = {
    getAnalyticsPage, getProducts, getAddProductPage, postAddProduct, getEditProductPage, postUpdateProduct,
    deleteProduct, getUserPage, getAddUserPage, postAddUser, getUserEditPage, postUserEdit, postUserDelete,
    getCategories, getAddCategoryPage, getEditCategoryPage, postAddCategory, postEditCategory, postDeletedCategory,
    getOrdersPage, getOrdersCount, exportOrders, deleteSize
};