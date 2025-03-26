const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const cacheMiddleware = require("../middleware/cacheMiddleware");

router.get("/", cacheMiddleware, async (req, res) => {
    try {
        const orders = await Order.find();
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
