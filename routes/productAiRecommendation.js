const express = require("express");
const axios = require("axios");
const Product = require("../models/Product");
const UserActivity = require("../models/userActivity");
const router = express.Router();

// Product Page Recommendation
router.get("/recommend/product/:productId", async (req, res) => {
    try {
        const product = await Product.findById(req.params.productId);
        if (!product) return res.status(404).json({ message: "Product not found" });

        const allProducts = await Product.find().lean();
        const formattedProducts = allProducts.map(p => ({
            ...p,
            _id: p._id.toString(),
        }));

        const response = await axios.post("http://127.0.0.1:5001/recommend", {
            target_product_id: product._id.toString(),
            products: formattedProducts,
        });

        const ids = response.data.recommendations || [];
        const recommendedProducts = await Product.find({ _id: { $in: ids } });
        res.json({ message: "Product Page Recommendations", data: recommendedProducts });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Home Page Recommendation
router.get("/recommend/home/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const activity = await UserActivity.findOne({ user: userId }).populate(
            "viewedProducts purchasedProducts"
        );
        if (!activity) {
            const latest = await Product.find().sort({ createdAt: -1 }).limit(10);
            return res.json({
                message: "No activity found — showing latest products",
                data: latest,
            });
        }

        const allProducts = [
            ...activity.viewedProducts,
            ...activity.purchasedProducts,
        ];
        if (!allProducts.length) {
            const latest = await Product.find().sort({ createdAt: -1 }).limit(10);
            return res.json({
                message: "No activity found — showing latest products",
                data: latest,
            });
        }

        // Create Object
        const formattedProducts = allProducts.map((p) => ({
            _id: p._id.toString(),
            title: p.name || "",
            description: p.description || "",
            category: p.category ? p.category.toString() : "",
            tags: Array.isArray(p.tags) ? p.tags : [],
        }));

        const response = await axios.post("http://127.0.0.1:5001/recommend", {
            user_profile: formattedProducts,
        });

        const ids = response.data.recommendations || [];
        const recommendedProducts = await Product.find({ _id: { $in: ids } });

        res.json({
            message: "Home Page Recommendations",
            data: recommendedProducts,
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
