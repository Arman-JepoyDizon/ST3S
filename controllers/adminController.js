// File: controllers/adminController.js

const Product = require('../models/product');
const Price = require('../models/price');
const User = require('../models/user');
const Category = require('../models/category');
const Transaction = require('../models/transaction'); 
const Size = require('../models/size');

const getAnalyticsPage = async (req, res) => {
    try {
        const { filter, dateRange } = req.query;
        let startDate = new Date();
        let endDate = new Date();
        let currentFilter = filter || 'today';
        let customDateRange = null;

        endDate.setHours(23, 59, 59, 999);

        // Updated: Logic now prioritizes dateRange for custom filters
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
                case 'week':
                    startDate.setDate(startDate.getDate() - 6);
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case 'month':
                    startDate.setMonth(startDate.getMonth() - 1);
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case 'year':
                    startDate.setFullYear(startDate.getFullYear() - 1);
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case 'today':
                default:
                    startDate.setHours(0, 0, 0, 0);
                    currentFilter = 'today';
                    break;
            }
        }

        const dateQuery = { createdAt: { $gte: startDate, $lte: endDate } };

        const totalOrders = await Transaction.countDocuments(dateQuery);
        const salesData = await Transaction.aggregate([
            { $match: { status: 'Completed', ...dateQuery } },
            { $group: { _id: null, totalSales: { $sum: '$totalAmount' } } }
        ]);
        const totalSales = salesData.length > 0 ? salesData[0].totalSales : 0;

        const bestSellers = await Transaction.aggregate([
            { $match: { status: 'Completed', ...dateQuery } },
            { $unwind: '$items' },
            { 
                $group: { 
                    _id: { productId: '$items.productId', sizeLabel: '$items.sizeLabel' }, 
                    totalQuantity: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
                } 
            },
            { $sort: { totalRevenue: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id.productId',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: '$productDetails' }
        ]);
        
        // --- Adaptive Chart Data Logic ---
        let salesTrendData;
        if (currentFilter === 'year' || (currentFilter === 'custom' && (endDate - startDate) / (1000 * 60 * 60 * 24) > 60)) {
            const monthlySales = await Transaction.aggregate([
                { $match: { status: 'Completed', ...dateQuery } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                        monthlyTotal: { $sum: "$totalAmount" }
                    }
                },
                { $sort: { _id: 1 } }
            ]);
            const salesMap = new Map(monthlySales.map(d => [d._id, d.monthlyTotal]));
            const labels = [];
            const data = [];
            let dateIterator = new Date(startDate);
            while (dateIterator <= endDate) {
                const monthString = dateIterator.toISOString().slice(0, 7);
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
                { $match: { status: 'Completed', ...dateQuery } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        dailyTotal: { $sum: "$totalAmount" }
                    }
                },
                { $sort: { _id: 1 } }
            ]);
            const salesMap = new Map(dailySales.map(d => [d._id, d.dailyTotal]));
            const labels = [];
            const data = [];
            
            let dateIterator = new Date(startDate);
             while (dateIterator <= endDate) {
                const dateString = dateIterator.toISOString().split('T')[0];
                labels.push(dateIterator.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
                data.push(salesMap.get(dateString) || 0);
                dateIterator.setDate(dateIterator.getDate() + 1);
            }
            salesTrendData = { labels, data, title };
        }

        const recentTransactions = await Transaction.find({})
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('createdBy', 'username')
            .populate('items.productId', 'name');

        const topProductsData = {
            labels: bestSellers.map(p => `${p.productDetails.name}${p._id.sizeLabel ? ` - ${p._id.sizeLabel}` : ''}`),
            data: bestSellers.map(p => p.totalQuantity)
        };

        res.render('admin/dashboard', { 
            user: req.session.user,
            activePage: 'analytics',
            totalSales,
            totalOrders,
            bestSellers,
            salesTrendData,
            topProductsData,
            recentTransactions,
            currentFilter,
            customDateRange,
            query: req.query // Fixed: Pass the query object to the view
        });

    } catch (error) {
        console.error('Error fetching analytics data:', error);
        res.status(500).send('Server error');
    }
};

const getOrdersPage = async (req, res) => {
    try {
        const { search, dateRange, status } = req.query;
        let filterQuery = {};

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filterQuery = {
                $expr: {
                    $regexMatch: {
                        input: { $substr: [{ $toString: "$_id" }, -6, 6] },
                        regex: searchRegex
                    }
                }
            };
        }

        if (dateRange) {
            const [startDateStr, endDateStr] = dateRange.split(' to ');
            const startDate = new Date(startDateStr);
            startDate.setHours(0, 0, 0, 0);

            const endDate = endDateStr ? new Date(endDateStr) : new Date(startDate);
            endDate.setHours(23, 59, 59, 999);

            filterQuery.createdAt = { $gte: startDate, $lte: endDate };
        }

        if (status) {
            filterQuery.status = status;
        }

        const totalTransactionsCount = await Transaction.countDocuments({});
        const transactions = await Transaction.find(filterQuery)
            .sort({ createdAt: -1 })
            .populate('createdBy', 'username')
            .populate('items.productId', 'name');

        res.render('admin/orders', {
            user: req.session.user,
            transactions: transactions,
            totalTransactionsCount: totalTransactionsCount,
            query: req.query,
            activePage: 'orders'
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Server Error');
    }
};

const getOrdersCount = async (req, res) => {
    try {
        const { dateRange, status } = req.query;
        let filterQuery = {};

        if (dateRange) {
            const [startDateStr, endDateStr] = dateRange.split(' to ');
            const startDate = new Date(startDateStr);
            startDate.setHours(0, 0, 0, 0);

            const endDate = endDateStr ? new Date(endDateStr) : new Date(startDate);
            endDate.setHours(23, 59, 59, 999);

            filterQuery.createdAt = { $gte: startDate, $lte: endDate };
        }

        if (status) {
            filterQuery.status = status;
        }

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
        let filterQuery = {};

        if (dateRange) {
            const [startDateStr, endDateStr] = dateRange.split(' to ');
            const startDate = new Date(startDateStr);
            startDate.setHours(0, 0, 0, 0);
            
            const endDate = endDateStr ? new Date(endDateStr) : new Date(startDate);
            endDate.setHours(23, 59, 59, 999);

            filterQuery.createdAt = { $gte: startDate, $lte: endDate };
        }
        
        if (status) {
            filterQuery.status = status;
        }

        const transactions = await Transaction.find(filterQuery)
            .sort({ createdAt: -1 })
            .populate('createdBy', 'username')
            .populate('items.productId', 'name');

        const exportFields = Array.isArray(fields) ? fields : (fields ? [fields] : []);
        if (exportFields.length === 0) {
            return res.status(400).send('No fields selected for export.');
        }
        
        const headerMap = {
            orderId: 'Order Number',
            date: 'Date',
            time: 'Time',
            items: 'Item Details',
            status: 'Status',
            totalAmount: 'Total Amount',
            createdBy: 'Created By',
            paymentMethod: 'Payment Method',
            customerName: 'Customer Name',
            discount: 'Discount Details'
        };

        const csvHeaders = exportFields.map(field => headerMap[field] || field);
        
        const sanitizeField = (field) => {
            if (field === null || field === undefined) return '';
            const str = String(field);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const csvRows = transactions.map(t => {
            const row = {
                orderId: `ORD-${t._id.toString().slice(-6).toUpperCase()}`,
                date: new Date(t.createdAt).toLocaleDateString('en-CA'),
                time: new Date(t.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
                items: t.items.map(item => `${item.quantity}x ${item.productId ? item.productId.name : 'N/A'}${item.sizeLabel ? ` (${item.sizeLabel})` : ''}`).join('; '),
                status: t.status,
                totalAmount: t.totalAmount.toFixed(2),
                createdBy: t.createdBy ? t.createdBy.username : 'N/A',
                paymentMethod: t.paymentMethod,
                customerName: t.customerName || '',
                discount: t.discountApplied ? `Yes (-${t.discountAmount.toFixed(2)})` : 'No',
            };
            return exportFields.map(field => sanitizeField(row[field])).join(',');
        });
        
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
        const products = await Product.find({}).populate('category', 'name');
        res.render('admin/products', {
            user: req.session.user,
            products: products,
            activePage: 'products'
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send('Server error while fetching products.');
    }
};

const getAddProductPage = async (req, res) => {
    const categories = await Category.find()
    res.render('admin/addProduct', {
        user: req.session.user, categories: categories
    });
};


const postAddProduct = async (req, res) => {
    try {
        const { name, price, size, category, imageUrl } = req.body;
        console.log(req.body)

        const prices = Array.isArray(price) ? price : [price];

        let sizes = Array.isArray(size) ? size : []; 
        
        sizes = sizes.filter(s => s && s.trim() !== '');

        if(!name || !price || !category){
            return res.status(400).json({message: "Missing Field, please enter required Fields", type: "error"})
        }
        const lowestPrice = Math.min(...prices.map(p => parseFloat(p)))
        const newProduct = await Product.create({ name, price: lowestPrice, category, imageUrl });

        if(sizes.length > 0){
            var newSizes = []
            for(let i = 0; i < sizes.length; i++){
                const insertedSize = await Size.create({productId: newProduct._id, label: sizes[i]})
                newSizes.push(insertedSize)
            }
        }

        if(prices && prices.length > 0){
            var newProductPrice = []
            for(let i = 0; i < prices.length; i++){
                const insertedPrice = await Price.create({productId: newProduct._id, sizeId: (newSizes && newSizes[i]) ? newSizes[i]._id : null, price: prices[i]})
                newProductPrice.push(insertedPrice)
            }
        }

        if(newProductPrice.length<1){
            return res.status(500).json({message: "Error Creating Price", type: "error"})
        }

        if(!newProduct){
            return res.status(500).json({message: "Error Creating Product", type: "error"})
        }
        console.log("Added Product")
        return res.redirect('/admin/products');
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).send('Server error while adding product.');
    }
};

const getEditProductPage = async (req, res) => {
    try {
        const sizes = await Size.find({ productId: req.params.id, status: 'Active' });
        const prices = await Price.find({ productId: req.params.id, status: 'Active' });
        const categories = await Category.find();
        const product = await Product.findById(req.params.id);

        const pastSinglePrices = await Price.find({
        productId: req.params.id,
        status: "Inactive",
        sizeId: null
        }).sort({ createdAt: -1 });

        const pastSizePrices = await Price.find({
        productId: req.params.id,
        status: "Inactive",
        sizeId: { $ne: null }
        }).sort({ createdAt: -1 });

        const pastProductSizes = await Size.find({
        productId: req.params.id,
        status: "Inactive"
        }).sort({ createdAt: -1 });

        res.render('admin/editProduct', {
        user: req.session.user,
        product,
        sizes: sizes || [],
        prices,
        categories,
        pastSinglePrices,
        pastSizePrices,
        pastProductSizes,
        activePage: 'products'
        });

    } catch (error) {
        console.error('Error fetching product for edit:', error);
        res.status(500).send('Server error.');
    }
};

const postUpdateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const { name, price, size, category, imageUrl } = req.body;

    const prices = Array.isArray(price) ? price : [price];
    let sizes = Array.isArray(size) ? size : [];
    sizes = sizes.filter(s => s && s.trim() !== '');

    if (!name || !price || !category) {
      return res.status(400).json({
        message: "Missing required fields",
        type: "error"
      });
    }

    const newSinglePrice = parseFloat(prices[0]);
    const lowestPrice = Math.min(...prices.map(p => parseFloat(p)));

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const existingSizes = await Size.find({ productId });
    const existingPrices = await Price.find({ productId, status: "Active" });

    const existingLabels = existingSizes.map(s => s.label.toLowerCase());
    const normalizedNewLabels = sizes.map(x => x.toLowerCase());

    if (existingSizes.length > 0 && sizes.length === 0) {
      console.log("Transition: Many → One");
      await Price.updateMany({ productId }, { status: "Inactive" });
      await Size.deleteMany({ productId });
      await Price.create({
        productId,
        price: newSinglePrice,
        status: "Active"
      });
      await Product.findByIdAndUpdate(productId, {
        name,
        price: newSinglePrice,
        category,
        imageUrl
      });
      console.log("✅ Converted to single-price mode.");
      return res.redirect("/admin/products");
    }

    if (existingSizes.length === 0 && sizes.length > 0) {
      console.log("Transition: One → Many");
      await Price.updateMany(
        {
          productId,
          $or: [{ sizeId: { $exists: false } }, { sizeId: null }],
          status: "Active"
        },
        { status: "Inactive" }
      );
      for (let i = 0; i < sizes.length; i++) {
        const label = sizes[i].trim();
        const p = parseFloat(prices[i] || prices[0]);
        const newSize = await Size.create({ productId, label });
        await Price.create({
          productId,
          sizeId: newSize._id,
          price: p,
          status: "Active"
        });
      }
      await Product.findByIdAndUpdate(productId, {
        name,
        price: lowestPrice,
        category,
        imageUrl
      });
      console.log("✅ Converted to multi-price mode.");
      return res.redirect("/admin/products");
    }

    if (sizes.length > 0 && existingSizes.length > 0) {
        console.log("Updating multi-price product.");

        const keepSizeIds = new Set();

        for (let i = 0; i < sizes.length; i++) {
            const newLabel = String(sizes[i]).trim();
            const newPrice = parseFloat(prices[i] || prices[0]);

            console.log(newLabel)
            console.log(newPrice)

            let sizeDoc =
            existingSizes.find(s => s.label.toLowerCase() === newLabel.toLowerCase()) ||
            existingSizes[i];

            if (sizeDoc && sizeDoc.label.toLowerCase() !== newLabel.toLowerCase()) {
            await Size.findByIdAndUpdate(sizeDoc._id, { label: newLabel, status: "Active" });
            sizeDoc.label = newLabel;
            }

            if (!sizeDoc) {
            sizeDoc = await Size.create({ productId, label: newLabel });
            existingSizes.push(sizeDoc);
            } else {
            await Size.findByIdAndUpdate(sizeDoc._id, { status: "Active" });
            }

            keepSizeIds.add(String(sizeDoc._id));

            const currentPrice = await Price.findOne({
            productId,
            sizeId: sizeDoc._id,
            status: "Active",
            });

            if (!currentPrice) {
            const matchingInactive = await Price.findOne({
                productId,
                sizeId: sizeDoc._id,
                price: newPrice,
                status: "Inactive",
            });
            if (matchingInactive) {
                await Price.findByIdAndUpdate(matchingInactive._id, {
                status: "Active",
                effectiveDate: new Date(),
                });
            } else {
                await Price.create({
                productId,
                sizeId: sizeDoc._id,
                price: newPrice,
                status: "Active",
                });
            }
            } else if (currentPrice.price !== newPrice) {
            await Price.findByIdAndUpdate(currentPrice._id, { status: "Inactive" });

            const matchingInactive = await Price.findOne({
                productId,
                sizeId: sizeDoc._id,
                price: newPrice,
                status: "Inactive",
            });
            if (matchingInactive) {
                await Price.findByIdAndUpdate(matchingInactive._id, {
                status: "Active",
                effectiveDate: new Date(),
                });
            } else {
                await Price.create({
                productId,
                sizeId: sizeDoc._id,
                price: newPrice,
                status: "Active",
                });
            }
            }
        }

        const toDeactivate = existingSizes.filter(s => !keepSizeIds.has(String(s._id)));
        for (const s of toDeactivate) {
            await Size.findByIdAndUpdate(s._id, { status: "Inactive" });
            await Price.updateMany({ productId, sizeId: s._id, status: "Active" }, { status: "Inactive" });
        }

        await Price.updateMany(
            {
            productId,
            $or: [{ sizeId: { $exists: false } }, { sizeId: null }],
            status: "Active",
            },
            { status: "Inactive" }
        );

        const activePrices = await Price.find({ productId, status: "Active" });
        const lowestActivePrice = activePrices.length > 0
            ? Math.min(...activePrices.map(p => parseFloat(p.price)))
            : 0;

        await Product.findByIdAndUpdate(productId, {
            name,
            category,
            imageUrl,
            price: lowestActivePrice,
        });

        console.log("✅ Multi-price product updated (labels + prices) without blanking.");
    }


    if (existingSizes.length === 0 && sizes.length === 0) {
      console.log("Single-price product update.");
      const existingPrice = existingPrices[0];
      if (!existingPrice || existingPrice.price !== newSinglePrice) {
        await Price.updateMany({ productId }, { status: "Inactive" });
        await Price.create({
          productId,
          price: newSinglePrice,
          status: "Active"
        });
      }
    }
    await Product.findByIdAndUpdate(productId, {
      name,
      price: lowestPrice,
      category,
      imageUrl
    });
    console.log("✅ Product updated successfully!");
    return res.redirect("/admin/products");
  } catch (error) {
    console.error("❌ Error updating product:", error);
    res.status(500).send("Server error while updating product.");
  }
};


const deleteProduct = async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.redirect('/admin/products');
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).send('Server error while deleting product.');
    }
};

const getUserPage = async (req, res) => {
    try{
        const users = await User.find({}).sort({createdAt: 'desc'})
        res.render('admin/users',{user: req.session.user, users: users, activePage: 'users'})
    }catch(error){
        console.error(error)
        res.status(500).json({message: "Error fetching Users Page", type: "error"})
    }
}

const getAddUserPage = async (req, res) => {
    try{
        res.render('admin/addUser',{user:req.session.user, activePage: 'users'})
    }catch(error){
        console.error(error)
        res.status(500).json({message: "Error Getting Add User Page", type: "error"})
    }
}

const postAddUser = async (req, res) => {
    try{
        const {username, password, passwordRepeat, role} = req.body
        const existingUser = await User.findOne({username: username})
        if(!username || !password || !passwordRepeat || !role){
            return res.status(400).json({message: "Missing Field, please enter required Fields", type: "error"})
        }

        if(existingUser){
            return res.status(400).json({message: "Username already exists", type: "error"})
        }

        if(password != passwordRepeat){
            return res.status(400).json({message: "Passwords do not match", type: "error"})
        }
        const newUser = await User.create({username: username, role: role, password: password})
        if(!newUser){
            return res.status(500).json({message: "Error Creating User", type: "error"})
        }
        res.redirect('/admin/users');
    }catch(error){
        console.error(error)
        return res.status(500).send("Error creating user.")
    }
}

const getUserEditPage = async (req, res) => {
    try{
        const id = req.params.id
        const user = await User.findById(id)
        if(!user){
            return res.status(400).json({message: "User not found", type: "error"})
        }
        res.render('admin/editUser', {user: req.session.user, user_details: user, activePage: 'users'})
    }catch(error){
        console.error(error)
        return res.status(500).json({message: "Error getting edit user page", type:"error"})
    }
}

const postUserEdit = async (req, res)=>{
    try{
        const id = req.params.id
        const {username, role} = req.body
        if(!username || !role){
            res.return(400).json({message: "Missing Field, please enter required Fields", type: "error"})
        }
        const updatedUser = await User.findOneAndUpdate({ _id: id }, {username:username, role:role})
        if(!updatedUser){
            return res.status(400).json({message:"Error Updating user: User Not Found", type: "error"})
        }
        console.log("User Updated")
        res.redirect('/admin/users');
    }catch(error){
        console.error(error)
        return res.status(500).json({message: "Error Updating User", type: "error"})
    }
}

const postUserDelete = async (req, res) => {
    try{
        const id = req.params.id
        const deletedUser = await User.findByIdAndDelete(id)
        if(!deletedUser){
            return res.status(400).json({message: "Error deleting user: User not found", type: "error"})
        }
        console.log("User Deleted Successfully")
        res.redirect('/admin/users');
    }catch(error){
        console.error(error)
        return res.status(500).json({message: "Error deleting user", type: "error"})
    }
}

const getCategories = async (req, res) => {
    try{
        const categories = await Category.find()
        res.render('./admin/categories',{user: req.session.user, categories: categories})
    }catch(error){
        console.log("Error getting categories page: ",error)
        res.status(500).json({message: "Error Getting Categories", type: "error"})
    }
}

const getAddCategoryPage = async (req, res) => {
    try{
        res.render('./admin/addCategory',{user: req.session.user})
    }catch(error){
        console.log("Error getting add category page: ",error)
        res.status(500).json({message: "Error Getting Add Category Page", type: "error"})
    }
}

const getEditCategoryPage = async (req, res) => {
    try{
        const id = req.params.id
        const category_details = await Category.findById(id)
        res.render('./admin/editCategory',{user: req.session.user, category_details: category_details})
    }catch(error){
        console.log("Error getting edit category page: ",error)
        res.status(500).json({message: "Error Getting Edit Category Page", type: "error"})
    }
}

const postAddCategory = async (req, res) => {
    try{
        const {name} = req.body
        const newCategory = await Category.create({name})
        if(!newCategory){
            res.status(500).json({message: "Error Creating Category"})
        }
        console.log("Added Category")
        res.status(2000).redirect('/admin/categories')
    }catch(error){
        console.log("Error Creating Category",error)
        res.status(500).json({message: "Error Adding Category", type: "error"})
    }
}

const postEditCategory = async (req, res) => {
    try{
        const id = req.params.id
        const {name} = req.body
        const updatedCategory = await Category.findByIdAndUpdate(id, {name})
        if(!updatedCategory){
            res.status(500).json({message: "Error Updating Category"})
        }
        res.status(200).redirect('/admin/categories')
    }catch(error){
        console.log("Error Editing Category: ",error)
        res.status(500).json({message: "Error Editing Category", type: "error"})
    }
}

const postDeletedCategory = async (req, res) => {
    try{
        const id = req.params.id
        const deletedCategory = await Category.findByIdAndDelete(id)
        if(!deletedCategory){
            res.status(500).json({message: "Error Deleting Category"})
        }
        res.status(200).redirect('/admin/categories')
    }catch(error){
        console.log("Error Deleting Category: ",error)
        res.status(500).json({message: "Error Deleting Category", type: "error"})
    }
}

const deleteSize = async (req, res) => {
    try {
        const sizeId = req.params.id;
        const sizeToDelete = await Size.findById(sizeId);

        if (!sizeToDelete) {
            return res.status(404).send("Size not found");
        }

        await Price.updateMany({ sizeId: sizeId }, { status: 'Inactive' });
        await Size.findByIdAndDelete(sizeId);

        res.redirect(`/admin/products/edit/${sizeToDelete.productId}`);
    } catch (error) {
        console.error('Error deleting size:', error);
        res.status(500).send('Server error while deleting size.');
    }
};

module.exports = {
    getAnalyticsPage,
    getProducts,
    getAddProductPage,
    postAddProduct,
    getEditProductPage,
    postUpdateProduct,
    deleteProduct,
    getUserPage,
    getAddUserPage,
    postAddUser,
    getUserEditPage,
    postUserEdit,
    postUserDelete,
    getCategories,
    getAddCategoryPage,
    getEditCategoryPage,
    postAddCategory,
    postEditCategory,
    postDeletedCategory,
    getOrdersPage,
    getOrdersCount,
    exportOrders,
    deleteSize
};