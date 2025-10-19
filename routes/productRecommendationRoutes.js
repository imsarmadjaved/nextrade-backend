const express = require("express");
const Product = require("../models/Product");
const UserActivity = require("../models/userActivity");
const router = express.Router();

// View Recomendation (HomePage)
router.get("/home/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        const activity = await UserActivity.findOne({ user: userId }).populate("viewedProducts purchasedProducts");
        if (!activity) {
            return res.status(404).json({ message: "No activity found" });
        }

        const allProducts = [...activity.viewedProducts, ...activity.purchasedProducts];

        const categories = allProducts.map(p => p.category);
        const tags = allProducts.flatMap(p => p.tags);

        // Find similar products
        const recommended = await Product.find({
            _id: { $nin: allProducts.map(p => p._id) },
            $or: [
                { category: { $in: categories } },
                { tags: { $in: tags } }
            ]
        }).limit(6);

        res.json({ recommendedProducts: recommended });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// View Recomendation (Product detail page)
router.get("/product/:productId", async (req, res) => {
    try {
        const product = await Product.findById(req.params.productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // similar product
        const recommendations = await Product.find({
            _id: { $ne: product._id },
            $or: [
                { category: product.category },
                { tags: { $in: product.tags } },
            ],
        }).limit(6);

        res.json({
            recommendedProducts: recommendations,
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
