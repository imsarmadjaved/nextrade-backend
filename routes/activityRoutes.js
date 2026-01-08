const express = require("express");
const router = express.Router();
const UserActivity = require("../models/userActivity");
const verifyToken = require("../middleware/authMiddleware");

// Track when a user views a product
router.post("/view/:userId/:productId", verifyToken, async (req, res) => {
    try {
        const { userId, productId } = req.params;

        // Find existing activity or create new one
        let activity = await UserActivity.findOne({ user: userId });

        if (!activity) {
            activity = new UserActivity({ user: userId });
        }

        // Add product to viewed list if not already there
        // Using toString() to ensure proper comparison of ObjectIds
        if (!activity.viewedProducts.some(id => id.toString() === productId)) {
            activity.viewedProducts.push(productId);
        }

        await activity.save();

        res.json({ message: "View tracked successfully", activity });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Track when a user purchases a product
router.post("/purchase/:userId/:productId", verifyToken, async (req, res) => {
    try {
        const { userId, productId } = req.params;

        // Find existing activity or create new one
        let activity = await UserActivity.findOne({ user: userId });

        if (!activity) {
            activity = new UserActivity({ user: userId });
        }

        // Add product to purchased list if not already there
        if (!activity.purchasedProducts.includes(productId)) {
            activity.purchasedProducts.push(productId);
        }

        await activity.save();

        res.json({ message: "Purchase tracked successfully", activity });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get all purchased products for a specific user
router.get("/user/:userId/purchased-products", verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;

        // Security check: users can only see their own data, admins can see anyone's
        if (req.user.id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({
                message: "Access denied"
            });
        }

        // Find user's activity record
        let activity = await UserActivity.findOne({ user: userId });

        // Return empty array if no activity found
        if (!activity) {
            return res.json({
                purchasedProducts: []
            });
        }

        // Return purchased products
        res.json({
            purchasedProducts: activity.purchasedProducts || []
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;