const express = require('express');
const router = express.Router();

// Controller
// const frontlineController = require('../controllers/frontlineController');

// ORder screen
router.get('/', /* frontlineController.getOrderScreen */);

// Place Order
router.post('/order/place', /* frontlineController.placeOrder */);

// sales view 
router.get('/sales/today', /* frontlineController.getTodaysSales */);

module.exports = router;