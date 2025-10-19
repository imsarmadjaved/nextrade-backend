const express = require("express");
const router = express.Router();
const Review = require("../models/Review");
const Product = require("../models/Product");

// Add Review
router.post("/", async (req, res) => {
    try {
        const { productId, userId, rating, comment } = req.body;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        const existingReview = await Review.findOne({ product: productId, user: userId });
        if (existingReview) {
            return res.status(400).json({ message: "You have already reviewed this product" });
        }

        const review = new Review({
            product: productId,
            user: userId,
            rating,
            comment,
        });

        await review.save();

        res.status(201).json({
            message: "Review added successfully",
            review,
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// View all reviews of product
router.get("/:productId", async (req, res) => {
    try {
        const { productId } = req.params;

        const reviews = await Review.find({ product: productId }).populate("user", "name email");

        if (reviews.length === 0) {
            return res.status(404).json({ message: "No reviews for this product yet" });
        }

        const avgRating =
            reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;

        res.json({
            totalReviews: reviews.length,
            averageRating: avgRating.toFixed(1),
            reviews,
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Delete Review
router.delete("/:reviewId", async (req, res) => {
    try {
        const { reviewId } = req.params;

        const review = await Review.findById(reviewId);
        if (!review) {
            return res.status(404).json({ message: "Review not found" });
        }

        await Review.findByIdAndDelete(reviewId);

        res.json({ message: "Review deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
