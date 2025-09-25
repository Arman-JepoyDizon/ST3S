const express = require('express');
const router = express.Router();

// Frontline Controller Dto Soon
// const frontlineController = require('../controllers/frontlineController');

// Main Order Screen Route
router.get('/', /* frontlineController.getOrderScreen */);


router.post('/order/place', /* frontlineController.placeOrder */);

// View Today's Sales Route
router.get('/sales/today', /* frontlineController.getTodaysSales */);

module.exports = router;