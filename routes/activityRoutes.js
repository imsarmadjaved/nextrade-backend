const express = require("express");
const router = express.Router();
const UserActivity = require("../models/userActivity");

// Track viewed product
router.post("/view/:userId/:productId", async (req, res) => {
    try {
        const { userId, productId } = req.params;

        let activity = await UserActivity.findOne({ user: userId });

        if (!activity) {
            activity = new UserActivity({ user: userId });
        }

        if (!activity.viewedProducts.some(id => id.toString() === productId)) {
            activity.viewedProducts.push(productId);
        }


        await activity.save();

        res.json({ message: "View tracked successfully", activity });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Track purchased product
router.post("/purchase/:userId/:productId", async (req, res) => {
    try {
        const { userId, productId } = req.params;

        let activity = await UserActivity.findOne({ user: userId });

        if (!activity) {
            activity = new UserActivity({ user: userId });
        }

        if (!activity.purchasedProducts.includes(productId)) {
            activity.purchasedProducts.push(productId);
        }

        await activity.save();

        res.json({ message: "Purchase tracked successfully", activity });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
