const express = require("express");
const Category = require("../models/Category");
const Product = require("../models/Product");
const { uploadSingle } = require("../middleware/upload");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");
const cloudinary = require("cloudinary").v2;

// Add Category
router.post(
    "/",
    verifyToken,
    roleCheck(["admin"]),
    async (req, res) => {
        try {
            const { name, description, icon, isFeatured, image } = req.body;

            console.log("=== CREATE CATEGORY DEBUG ===");
            console.log("Request body:", req.body);

            const existing = await Category.findOne({ name });
            if (existing) {
                return res.status(400).json({ message: "Category already exists" });
            }

            // Create category with image URL from request body
            const categoryData = {
                name,
                description,
                icon,
                isFeatured: isFeatured || false,
            };

            // Add image if provided as URL
            if (image) {
                categoryData.image = {
                    url: image,
                    publicId: null
                };
            }

            const category = new Category(categoryData);
            await category.save();

            const savedCategory = category.toObject();
            savedCategory.image = savedCategory.image?.url || "";

            res.status(201).json({
                message: "Category created successfully",
                category: savedCategory
            });
        } catch (err) {
            console.error("Error creating category:", err);
            res.status(500).json({
                message: "Server error",
                error: err.message
            });
        }
    }
);

// Get All Categories
router.get("/", async (req, res) => {
    try {
        const categories = await Category.find().sort({ createdAt: -1 });

        // Format categories with proper image URLs
        const formattedCategories = categories.map(category => ({
            ...category.toObject(),
            image: category.image?.url || ""
        }));

        res.json(formattedCategories);
    } catch (err) {
        console.error("Error fetching categories:", err);
        res.status(500).json({
            message: "Server error",
            error: err.message
        });
    }
});

// Product Count
router.get("/with-counts", async (req, res) => {
    try {
        console.log("Fetching categories with counts...");

        const categories = await Category.find().sort({ createdAt: -1 });

        const categoriesWithCounts = await Promise.all(
            categories.map(async (category) => {
                try {
                    const productCount = await Product.countDocuments({
                        category: category._id
                    });

                    // Always return image as string URL
                    let imageUrl = category.image?.url || "";

                    return {
                        _id: category._id,
                        name: category.name,
                        description: category.description,
                        image: imageUrl,
                        icon: category.icon,
                        isFeatured: category.isFeatured,
                        productCount,
                        createdAt: category.createdAt,
                        updatedAt: category.updatedAt
                    };
                } catch (countError) {
                    console.error(`Error counting products for category ${category._id}:`, countError);
                    return {
                        ...category.toObject(),
                        productCount: 0,
                        image: category.image?.url || ""
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

router.get("/with-product-counts", async (req, res) => {
    try {
        console.log("Fetching categories with product counts (alternative)...");
        const categories = await Category.find().sort({ createdAt: -1 });

        const categoriesWithCounts = await Promise.all(
            categories.map(async (category) => {
                const productCount = await Product.countDocuments({
                    category: category._id
                });

                // Convert image to string URL
                const imageUrl = category.image?.url || "";

                return {
                    _id: category._id,
                    name: category.name,
                    description: category.description,
                    image: imageUrl,
                    icon: category.icon,
                    isFeatured: category.isFeatured,
                    productCount,
                    createdAt: category.createdAt,
                    updatedAt: category.updatedAt
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

        const formatted = featuredCategories.map(cat => ({
            ...cat.toObject(),
            image: cat.image?.url || ""
        }));

        res.json(formatted);
    } catch (err) {
        res.status(500).json({
            message: "Server error",
            error: err.message
        });
    }
});

// Get Category by ID
router.get("/:id", async (req, res) => {
    try {
        console.log("Fetching category by ID:", req.params.id);
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ message: "Category not found" });

        // Add this debug log
        console.log("Found category:", {
            id: category._id,
            name: category.name,
            image: category.image,
            imageType: typeof category.image
        });

        // Convert to plain object and format image
        const categoryObj = category.toObject();
        categoryObj.image = categoryObj.image?.url || "";

        // Debug the final output
        console.log("Final category object:", categoryObj);

        res.json(categoryObj);
    } catch (err) {
        console.error("Error fetching category:", err);
        res.status(500).json({
            message: "Server error",
            error: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// Update Category
router.put(
    "/:id",
    verifyToken,
    roleCheck(["admin"]),
    async (req, res) => {
        try {
            console.log("=== UPDATE CATEGORY DEBUG ===");
            console.log("Request body:", req.body);

            const { name, description, icon, isFeatured, image } = req.body;
            const categoryId = req.params.id;

            // Find the category
            const category = await Category.findById(categoryId);
            if (!category) {
                return res.status(404).json({ message: "Category not found" });
            }

            // Check for name uniqueness
            if (name && name !== category.name) {
                const existing = await Category.findOne({ name });
                if (existing) {
                    return res.status(400).json({ message: "Category name already exists" });
                }
                category.name = name;
            }

            // Update basic fields
            if (description !== undefined) category.description = description;
            if (icon !== undefined) category.icon = icon;
            if (isFeatured !== undefined) category.isFeatured = isFeatured;

            // Handle image - accept URL from request body
            if (image !== undefined) {
                if (image) {
                    if (category.image?.publicId) {
                        await cloudinary.uploader.destroy(category.image.publicId);
                    }

                    category.image = {
                        url: image,
                        publicId: null
                    };
                } else {
                    if (category.image?.publicId) {
                        await cloudinary.uploader.destroy(category.image.publicId);
                    }
                    category.image = { url: "", publicId: null };
                }
            }

            await category.save();

            // Format response
            const updatedCategory = category.toObject();
            updatedCategory.image = updatedCategory.image?.url || "";

            res.json({
                message: "Category updated successfully",
                category: updatedCategory,
                imageUpdated: image !== undefined
            });
        } catch (err) {
            console.error("ERROR updating category:", err);
            res.status(500).json({
                message: "Server error",
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            });
        }
    }
);

// Remove Category
router.delete("/:id", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }

        // Delete image from Cloudinary if exists
        if (category.image && category.image.publicId) {
            try {
                await cloudinary.uploader.destroy(category.image.publicId);
                console.log(`Deleted image from Cloudinary: ${category.image.publicId}`);
            } catch (cloudinaryErr) {
                console.error("Error deleting from Cloudinary:", cloudinaryErr);
                // Continue with deletion even if Cloudinary fails
            }
        }

        // Delete category from database
        await Category.findByIdAndDelete(req.params.id);

        res.json({
            message: "Category deleted successfully",
            deletedImage: category.image ? true : false
        });
    } catch (err) {
        console.error("Error deleting category:", err);
        res.status(500).json({
            message: "Server error",
            error: err.message
        });
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

            let imageUrl =
                category.image?.url ||
                "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop";

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