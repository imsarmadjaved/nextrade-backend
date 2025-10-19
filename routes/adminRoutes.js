const express = require("express");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const router = express.Router();

// view all (Admin use)
router.get("/users", async (req, res) => {
    try {
        const users = await User.find().select("-password");

        if (!users || users.length === 0) {
            return res.status(404).json({ message: "No users found" });
        }

        res.status(200).json(users);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// block/unblock user
router.put("/block/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.isBlocked == false) {
            user.isBlocked = true;
        }
        else {
            user.isBlocked = false;
        }
        await user.save();

        res.status(200).json({ message: "User blocked successfully", user });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Admin Dashboard
router.get("/stats", async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalBuyers = await User.countDocuments({ role: "buyer" });
        const totalSellers = await User.countDocuments({ role: "seller" });
        const blockedUsers = await User.countDocuments({ isBlocked: true });
        const totalProducts = await Product.countDocuments();
        const totalOrders = await Order.countDocuments();

        res.status(200).json({
            totalUsers,
            totalBuyers,
            totalSellers,
            blockedUsers,
            totalProducts,
            totalOrders,
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});


module.exports = router;
