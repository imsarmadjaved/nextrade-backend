const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const UserActivity = require("../models/userActivity");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");

const AI_URL = "https://nextrade-product-ai-service-b4c3.up.railway.app";

// Helper functions
const isAIServiceAvailable = async () => {
    try {
        const response = await axios.get(`${AI_URL}/health`, { timeout: 5000 });
        return response.status === 200;
    } catch (error) {
        console.log("AI service unavailable, using fallback");
        return false;
    }
};

const formatProductForAI = (product) => ({
    _id: product._id.toString(),
    name: product.name || "",
    description: product.description || "",
    category: product.category?.name || product.category || "",
    tags: Array.isArray(product.tags) ? product.tags : [],
    price: product.price || 0
});

// fallback functions
const getFallbackProductRecommendations = async (productId, limit = 6) => {
    try {
        const product = await Product.findById(productId);
        if (!product) return [];

        const recommendations = await Product.find({
            _id: { $ne: productId },
            category: product.category,
            status: 'active'
        }).limit(limit).sort({ createdAt: -1 });

        return recommendations;
    } catch (error) {
        console.error("Fallback product recommendation error:", error);
        return [];
    }
};

const getEnhancedFallbackHomeRecommendations = async (userId, limit = 12) => {
    try {
        const activity = await UserActivity.findOne({ user: userId }).populate("viewedProducts purchasedProducts");

        if (!activity) {
            return await Product.find({ status: 'active' })
                .sort({ createdAt: -1 })
                .limit(limit);
        }

        const userProducts = [...activity.viewedProducts, ...activity.purchasedProducts];
        const categories = userProducts.map(p => p.category);
        const tags = userProducts.flatMap(p => p.tags);

        return await Product.find({
            _id: { $nin: userProducts.map(p => p._id) },
            $or: [
                { category: { $in: categories } },
                { tags: { $in: tags } }
            ]
        }).limit(limit);
    } catch (error) {
        console.error("Enhanced fallback home recommendation error:", error);
        return await Product.find({ status: 'active' })
            .sort({ createdAt: -1 })
            .limit(limit);
    }
};

// AI Product Page Recommendation
router.get("/recommend/product/:productId", async (req, res) => {
    try {
        const { productId } = req.params;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Check AI availability
        const aiAvailable = await isAIServiceAvailable();

        // Use fallback if AI unavailable
        if (!aiAvailable) {
            console.log("AI unavailable, using fallback for product recommendations");
            const fallbackRecs = await getFallbackProductRecommendations(productId);
            return res.json({
                message: "Product Recommendations (Fallback)",
                data: fallbackRecs,
                source: "fallback",
                reason: "ai_service_unavailable"
            });
        }

        // Get all active products for AI processing
        const allProducts = await Product.find({ status: 'active' })
            .populate('category', 'name')
            .lean();

        if (allProducts.length <= 1) {
            const fallbackRecs = await getFallbackProductRecommendations(productId);
            return res.json({
                message: "Not enough products for AI recommendations",
                data: fallbackRecs,
                source: "fallback",
                reason: "insufficient_products"
            });
        }

        // Format for AI
        const formattedProducts = allProducts.map(formatProductForAI);

        // Call AI service
        const response = await axios.post(`${AI_URL}/recommend`, {
            target_product_id: productId,
            products: formattedProducts,
        }, { timeout: 10000 });

        const recommendedIds = response.data.recommendations || [];

        let recommendedProducts = [];
        if (recommendedIds.length > 0) {
            recommendedProducts = await Product.find({
                _id: { $in: recommendedIds },
                status: 'active'
            });
        }

        // If AI returns insufficient results, use fallback
        if (recommendedProducts.length === 0) {
            console.log("AI returned no results, using fallback");
            recommendedProducts = await getFallbackProductRecommendations(productId);
        }

        res.json({
            message: recommendedProducts.length > 0 ? "AI Product Recommendations" : "Product Recommendations (AI + Fallback)",
            data: recommendedProducts,
            source: recommendedProducts.length > 0 ? "ai" : "fallback",
            aiResultsCount: recommendedIds.length,
            finalResultsCount: recommendedProducts.length
        });

    } catch (error) {
        console.error("Product AI recommendation error:", error);

        // Use fallback on any error
        const fallbackRecs = await getFallbackProductRecommendations(req.params.productId);

        res.json({
            message: "Product Recommendations (Fallback - Error)",
            data: fallbackRecs,
            source: "fallback_error",
            error: error.message
        });
    }
});

// AI Home Page Recommendation 
router.get("/recommend/home/:userId", verifyToken, roleCheck(["buyer"]), async (req, res) => {
    try {
        const { userId } = req.params;

        // Check AI availability first
        const aiAvailable = await isAIServiceAvailable();

        // Get user activity for both AI and fallback
        const activity = await UserActivity.findOne({ user: userId })
            .populate("viewedProducts purchasedProducts");

        const hasUserData = activity && (activity.viewedProducts.length > 0 || activity.purchasedProducts.length > 0);

        // Use fallback if AI unavailable OR insufficient user data
        if (!aiAvailable || !hasUserData) {
            console.log("Using fallback - AI unavailable or insufficient user data");
            const fallbackRecs = await getEnhancedFallbackHomeRecommendations(userId);
            return res.json({
                message: "Home Recommendations (Fallback)",
                data: fallbackRecs,
                source: "fallback",
                reason: !aiAvailable ? "ai_service_unavailable" : "insufficient_user_data",
                userData: {
                    hasActivity: !!activity,
                    viewedProducts: activity?.viewedProducts?.length || 0,
                    purchasedProducts: activity?.purchasedProducts?.length || 0
                }
            });
        }

        // Prepare user profile for AI
        let userProfile = [];
        if (hasUserData) {
            userProfile = [
                ...activity.viewedProducts,
                ...activity.purchasedProducts,
            ].map(formatProductForAI);
        }

        const allProducts = await Product.find({ status: 'active' }).lean();

        // Call AI service
        const response = await axios.post(`${AI_URL}/recommend`, {
            user_profile: userProfile,
            all_products: allProducts.map(formatProductForAI)
        }, { timeout: 10000 });

        const recommendedIds = response.data.recommendations || [];

        let recommendedProducts = [];
        if (recommendedIds.length > 0) {
            recommendedProducts = await Product.find({
                _id: { $in: recommendedIds },
                status: 'active'
            });
        }

        // If AI returns insufficient results, supplement with fallback
        if (recommendedProducts.length < 6) {
            console.log("AI returned insufficient results, supplementing with fallback");
            const supplementalRecs = await getEnhancedFallbackHomeRecommendations(userId, 12 - recommendedProducts.length);

            // Combine and remove duplicates
            const allRecs = [...recommendedProducts, ...supplementalRecs];
            const uniqueRecs = [];
            const seenIds = new Set();

            for (const product of allRecs) {
                if (!seenIds.has(product._id.toString())) {
                    seenIds.add(product._id.toString());
                    uniqueRecs.push(product);
                }
            }
            recommendedProducts = uniqueRecs.slice(0, 12);
        }

        res.json({
            message: "AI Home Recommendations",
            data: recommendedProducts,
            source: "ai_enhanced",
            strategy: response.data.strategy_used || "ai_personalized",
            userData: {
                activitiesCount: userProfile.length,
                hasPurchaseHistory: activity.purchasedProducts.length > 0,
                hasViewHistory: activity.viewedProducts.length > 0
            },
            aiResultsCount: recommendedIds.length,
            finalResultsCount: recommendedProducts.length
        });

    } catch (error) {
        console.error("Home AI recommendation error:", error);

        // Use fallback on any error
        const fallbackRecs = await getEnhancedFallbackHomeRecommendations(req.params.userId);

        res.json({
            message: "Home Recommendations (Fallback - Error)",
            data: fallbackRecs,
            source: "fallback_error",
            error: error.message
        });
    }
});

// Health check endpoint
router.get("/health", async (req, res) => {
    try {
        const aiAvailable = await isAIServiceAvailable();
        const activeProductsCount = await Product.countDocuments({ status: 'active' });
        const totalUsersWithActivity = await UserActivity.countDocuments();

        res.json({
            ai_service_available: aiAvailable,
            active_products_count: activeProductsCount,
            users_with_activity: totalUsersWithActivity,
            service: "product_ai_recommendation",
            status: "operational",
            features: {
                product_recommendations: true,
                home_recommendations: true,
                fallback_system: true
            }
        });
    } catch (error) {
        res.status(500).json({
            ai_service_available: false,
            service: "product_ai_recommendation",
            error: error.message
        });
    }
});

// Legacy fallback endpoints (for backward compatibility)
router.get("/fallback/home/:userId", verifyToken, roleCheck(["buyer"]), async (req, res) => {
    try {
        const fallbackRecs = await getEnhancedFallbackHomeRecommendations(req.params.userId);
        res.json({
            message: "Fallback Home Recommendations",
            recommendedProducts: fallbackRecs
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

router.get("/fallback/product/:productId", async (req, res) => {
    try {
        const fallbackRecs = await getFallbackProductRecommendations(req.params.productId);
        res.json({
            message: "Fallback Product Recommendations",
            recommendedProducts: fallbackRecs,
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
