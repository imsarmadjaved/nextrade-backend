const express = require("express");
const Category = require("../models/Category");
const Product = require("../models/Product");
const upload = require("../middleware/upload");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");

// Add Category
router.post(
    "/",
    verifyToken,
    roleCheck(["admin"]),
    upload.single("image"),
    async (req, res) => {
        const image = req.file?.path;

        try {
            const { name, description, image, icon, isFeatured } = req.body;

            const existing = await Category.findOne({ name });
            if (existing) {
                return res.status(400).json({ message: "Category already exists" });
            }

            const category = new Category({
                name,
                description,
                image,
                icon,
                isFeatured: isFeatured || false
            });
            await category.save();

            res.status(201).json({
                message: "Category created",
                category
            });
        } catch (err) {
            console.error("Error creating category:", err);
            res.status(500).json({ message: "Server error", error: err.message });
        }
    });

// Get All Categories
router.get("/", async (req, res) => {
    try {
        const categories = await Category.find().sort({ createdAt: -1 });
        res.json(categories);
    } catch (err) {
        console.error("Error fetching categories:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Product Count
router.get("/with-counts", async (req, res) => {
    try {
        console.log("Fetching categories with counts...");

        // Simple approach without aggregation
        const categories = await Category.find().sort({ createdAt: -1 });

        const categoriesWithCounts = await Promise.all(
            categories.map(async (category) => {
                try {
                    const productCount = await Product.countDocuments({
                        category: category._id
                    });
                    return {
                        _id: category._id,
                        name: category.name,
                        description: category.description,
                        image: category.image,
                        icon: category.icon,
                        isFeatured: category.isFeatured,
                        productCount: productCount,
                        createdAt: category.createdAt,
                        updatedAt: category.updatedAt
                    };
                } catch (countError) {
                    console.error(`Error counting products for category ${category._id}:`, countError);
                    return {
                        ...category.toObject(),
                        productCount: 0
                    };
                }
            })
        );

        console.log(`Successfully fetched ${categoriesWithCounts.length} categories with counts`);
        res.json(categoriesWithCounts);
    } catch (err) {
        console.error("Error in with-counts endpoint:", err);
        res.status(500).json({
            message: "Server error in with-counts",
            error: err.message
        });
    }
});

// Alternative simpler endpoint
router.get("/with-product-counts", async (req, res) => {
    try {
        console.log("Fetching categories with product counts (alternative)...");
        const categories = await Category.find().sort({ createdAt: -1 });

        const categoriesWithCounts = await Promise.all(
            categories.map(async (category) => {
                const productCount = await Product.countDocuments({
                    category: category._id
                });
                return {
                    ...category.toObject(),
                    productCount
                };
            })
        );

        res.json(categoriesWithCounts);
    } catch (err) {
        console.error("Error in with-product-counts endpoint:", err);
        res.status(500).json({
            message: "Server error",
            error: err.message
        });
    }
});

// Get featured categories
router.get("/featured/categories", async (req, res) => {
    try {
        const featuredCategories = await Category.find({ isFeatured: true });
        res.json(featuredCategories);
    } catch (err) {
        console.error("Error fetching featured categories:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get Category by ID
router.get("/:id", async (req, res) => {
    try {
        console.log("Fetching category by ID:", req.params.id);
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ message: "Category not found" });
        res.json(category);
    } catch (err) {
        console.error("Error fetching category:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Update Category
router.put("/:id", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const { name, description, image, icon, isFeatured } = req.body;

        const category = await Category.findByIdAndUpdate(
            req.params.id,
            {
                name,
                description,
                image,
                icon,
                isFeatured
            },
            { new: true, runValidators: true }
        );

        if (!category) return res.status(404).json({ message: "Category not found" });

        res.json({
            message: "Category updated",
            category
        });
    } catch (err) {
        console.error("Error updating category:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Remove Category
router.delete("/:id", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const category = await Category.findByIdAndDelete(req.params.id);
        if (!category) return res.status(404).json({ message: "Category not found" });
        res.json({ message: "Category deleted" });
    } catch (err) {
        console.error("Error deleting category:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Upload category image
router.post("/:id/upload-image", verifyToken, roleCheck(["admin"]), upload.single("image"), async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ message: "Category not found" });

        if (!req.file || !req.file.path) {
            return res.status(400).json({ message: "No image uploaded" });
        }

        // Validate file type
        if (!req.file.mimetype.startsWith("image/")) {
            return res.status(400).json({ message: "Only image files are allowed" });
        }

        // Save Cloudinary URL
        category.image = req.file.path;
        await category.save();

        res.json({
            message: "Category image uploaded successfully",
            imageUrl: req.file.path,
            category
        });
    } catch (err) {
        console.error("Error uploading category image:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

router.get("/featured/with-stats", async (req, res) => {
    try {
        console.time("FeaturedCategoriesWithStats");

        console.log("Fetching featured categories with stats...");

        // Get featured categories first
        const featuredCategories = await Category.find({ isFeatured: true })
            .select('name description image icon isFeatured createdAt updatedAt')
            .lean()
            .exec();

        console.log(`Found ${featuredCategories.length} featured categories`);

        if (featuredCategories.length === 0) {
            return res.json([]);
        }

        // Get category IDs for batch processing
        const categoryIds = featuredCategories.map(cat => cat._id);

        // Get product counts for all categories at once
        const productCounts = await Product.aggregate([
            {
                $match: {
                    category: { $in: categoryIds }
                }
            },
            {
                $group: {
                    _id: "$category",
                    totalProducts: { $sum: 1 },
                    bulkProducts: {
                        $sum: {
                            $cond: [{ $eq: ["$bulkPricingEnabled", true] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        // Create a map for quick lookup
        const statsMap = new Map();
        productCounts.forEach(stat => {
            statsMap.set(stat._id.toString(), {
                productCount: stat.totalProducts,
                bulkProducts: stat.bulkProducts
            });
        });

        // Process categories with their stats
        const categoriesWithStats = featuredCategories.map(category => {
            const categoryId = category._id.toString();
            const stats = statsMap.get(categoryId) || {
                productCount: 0,
                bulkProducts: 0
            };

            let imageUrl = "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop";
            if (category.image) {
                // Use Cloudinary URL directly
                imageUrl = category.image;
            }

            return {
                _id: category._id,
                name: category.name,
                description: category.description,
                image: imageUrl,
                icon: category.icon,
                isFeatured: category.isFeatured,
                createdAt: category.createdAt,
                updatedAt: category.updatedAt,
                productCount: stats.productCount,
                bulkProducts: stats.bulkProducts,
                isBulkEnabled: stats.bulkProducts > 0,
                discountRange: stats.bulkProducts > 0 ? "15-60% OFF" : "Standard Pricing"
            };
        });

        console.timeEnd("FeaturedCategoriesWithStats");
        console.log(`Processed ${categoriesWithStats.length} categories with stats`);

        res.json(categoriesWithStats);

    } catch (err) {
        console.error("Error in /featured/with-stats:", err);
        res.status(500).json({
            message: "Server error",
            error: err.message
        });
    }
});

module.exports = router;