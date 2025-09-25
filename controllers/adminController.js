// models ng las vegas
const Product = require('../models/product');
const User = require('../models/user');
const Price = require('../models/price');

// controller fncts
const adminController = {
    //soon analytics
    getDashboard: async (req, res) => {
       // dto render logic
    },

    // products
    getProducts: async (req, res) => {
        //dto logic ng petch
    },

    // Add New Product
    addProduct: async (req, res) => {
        //dto logic ng new pradacts
    },

    // update prod dto
    updateProduct: async (req, res) => {
        // update prod logic dto
    },

    // Remove Product
    removeProduct: async (req, res) => {
       
    },

    //kuha user
    getUsers: async (req, res) => {
       //dto render kuha user
    },

    // bago na user
    addUser: async (req, res) => {
        // logic para mag render
    }
};

module.exports = adminController;