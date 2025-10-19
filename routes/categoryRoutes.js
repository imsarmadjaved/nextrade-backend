const express = require("express");
const Category = require("../models/Category");
const router = express.Router();

// Add Category
router.post("/", async (req, res) => {
    try {
        const { name, description } = req.body;

        const existing = await Category.findOne({ name });
        if (existing) {
            return res.status(400).json({ message: "Category already exists" });
        }

        const category = new Category({ name, description });
        await category.save();

        res.status(201).json({ message: "Category created", category });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get All Categories
router.get("/", async (req, res) => {
    try {
        const categories = await Category.find();
        res.json(categories);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get Category by ID
router.get("/:id", async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ message: "Category not found" });
        res.json(category);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Update Category
router.put("/:id", async (req, res) => {
    try {
        const { name, description } = req.body;
        const category = await Category.findByIdAndUpdate(
            req.params.id,
            { name, description },
            { new: true }
        );
        if (!category) return res.status(404).json({ message: "Category not found" });
        res.json({ message: "Category updated", category });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Remove Category
router.delete("/:id", async (req, res) => {
    try {
        const category = await Category.findByIdAndDelete(req.params.id);
        if (!category) return res.status(404).json({ message: "Category not found" });
        res.json({ message: "Category deleted" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
