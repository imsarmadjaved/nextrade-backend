const express = require("express");
const Product = require("../models/Product");
const Category = require("../models/Category");
const router = express.Router();

// Add Product
router.post("/", async (req, res) => {
    try {
        const { name, description, price, stock, category, images, tags } = req.body;

        // Check if category exists
        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
            return res.status(400).json({ message: "Invalid category" });
        }

        const product = new Product({
            name,
            description,
            price,
            stock,
            category,
            images,
            tags,
        });

        await product.save();
        res.status(201).json({ message: "Product created", product });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get All Products
router.get("/", async (req, res) => {
    try {
        const products = await Product.find().populate("category", "name");
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get product by catagory
router.get("/category/:id", async (req, res) => {
    try {
        const products = await Product.find({ category: req.params.id }).populate("category", "name");
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get Single Product by ID
router.get("/:id", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate("category", "name");
        if (!product) return res.status(404).json({ message: "Product not found" });
        res.json(product);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Update Product
router.put("/:id", async (req, res) => {
    try {
        const { name, description, price, stock, category, images } = req.body;

        if (category) {
            const categoryExists = await Category.findById(category);
            if (!categoryExists) {
                return res.status(400).json({ message: "Invalid category" });
            }
        }

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { name, description, price, stock, category, images },
            { new: true }
        );

        if (!product) return res.status(404).json({ message: "Product not found" });
        res.json({ message: "Product updated", product });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Remove Product
router.delete("/:id", async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) return res.status(404).json({ message: "Product not found" });
        res.json({ message: "Product deleted" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
