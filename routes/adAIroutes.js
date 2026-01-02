const express = require("express");
const router = express.Router();
const axios = require("axios");
const Advertisement = require("../models/ad");
const UserActivity = require("../models/userActivity");
const verifyToken = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");

// AI service check
const isAdAIServiceAvailable = async () => {
    try {
        const AI_URL = "https://nextrade-ad-ai-service-8fe5.up.railway.app/";
        const response = await axios.get(`${AI_URL}/health`, { timeout: 5000 });
        return response.status === 200;
    } catch (error) {
        console.log("Ad AI service unavailable");
        return false;
    }
};

// user profiling for AI
const buildAIUserProfile = (activity) => {
    if (!activity) return { interests: "", activities: [] };

    const purchasedProducts = activity.purchasedProducts || [];
    const viewedProducts = activity.viewedProducts || [];

    const interests = [];

    // From purchased products (highest weight)
    purchasedProducts.forEach(product => {
        if (product.title) interests.push(product.title, product.title);
        if (product.description) interests.push(product.description);
        if (product.tags) interests.push(...product.tags, ...product.tags);
        if (product.category) interests.push(product.category, product.category);
    });

    // From viewed products
    viewedProducts.forEach(product => {
        if (product.title) interests.push(product.title);
        if (product.description) interests.push(product.description);
        if (product.tags) interests.push(...product.tags);
        if (product.category) interests.push(product.category);
    });

    const userActivities = [...purchasedProducts, ...viewedProducts].map(product => ({
        title: product.title || "",
        description: product.description || "",
        tags: product.tags || [],
        category: product.category ? product.category.toString() : ""
    }));

    return {
        interests: [...new Set(interests.filter(Boolean))].join(" "),
        activities: userActivities
    };
};

// fallback function
const getEnhancedFallbackAds = async (userId, limit = 6) => {
    try {
        const activity = await UserActivity.findOne({ user: userId })
            .populate("viewedProducts purchasedProducts", "category");

        // Analyze user behavior for fallback
        let preferredCategories = [];
        if (activity) {
            const purchasedProducts = activity.purchasedProducts || [];
            const viewedProducts = activity.viewedProducts || [];
            const allProducts = [...purchasedProducts, ...viewedProducts];

            const categoryCounter = {};
            allProducts.forEach(product => {
                if (product.category) {
                    const category = product.category.toString();
                    categoryCounter[category] = (categoryCounter[category] || 0) + 1;
                }
            });

            preferredCategories = Object.entries(categoryCounter)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([category]) => category);
        }

        let recommendedAds = [];

        // Strategy 1: Category-based recommendations
        if (preferredCategories.length > 0) {
            recommendedAds = await Advertisement.find({
                status: "approved",
                isActive: true,
                category: { $in: preferredCategories }
            })
                .limit(limit)
                .sort({
                    createdAt: -1,
                    totalCost: -1
                });
        }

        // Strategy 2: If not enough, fill with recent ads
        if (recommendedAds.length < limit) {
            const additionalAds = await Advertisement.find({
                status: "approved",
                isActive: true,
                _id: { $nin: recommendedAds.map(ad => ad._id) }
            })
                .limit(limit - recommendedAds.length)
                .sort({ createdAt: -1 });

            recommendedAds = [...recommendedAds, ...additionalAds];
        }

        // Strategy 3: Ultimate fallback
        if (recommendedAds.length === 0) {
            recommendedAds = await Advertisement.find({
                status: "approved",
                isActive: true
            })
                .limit(limit)
                .sort({ createdAt: -1 });
        }

        return recommendedAds;

    } catch (error) {
        console.error("Enhanced fallback ad error:", error);
        // Basic fallback
        return await Advertisement.find({
            status: "approved",
            isActive: true
        })
            .limit(6)
            .sort({ createdAt: -1 });
    }
};

// AI Ad Recommendations
router.post("/recommend_ads/:userId", verifyToken, async (req, res) => {
    try {
        const userId = req.params.userId;

        // Get active ads
        const ads = await Advertisement.find({
            status: "approved",
            isActive: true
        });

        if (ads.length === 0) {
            const fallbackAds = await getEnhancedFallbackAds(userId);
            return res.json({
                message: "No active ads available (Fallback)",
                count: fallbackAds.length,
                recommendedAds: fallbackAds,
                source: "fallback_no_ads"
            });
        }

        // Get user profile for AI
        const activity = await UserActivity.findOne({ user: userId })
            .populate("viewedProducts purchasedProducts", "title description tags category");

        const userProfile = buildAIUserProfile(activity);

        // Check AI service and user data conditions
        const aiAvailable = await isAdAIServiceAvailable();
        const hasSufficientData = userProfile.activities.length > 0;

        // Use fallback if AI unavailable or insufficient data
        if (!aiAvailable || !hasSufficientData) {
            console.log("Using fallback - AI unavailable or insufficient user data");
            const fallbackAds = await getEnhancedFallbackAds(userId);
            return res.json({
                message: "Ad Recommendations (Fallback)",
                count: fallbackAds.length,
                recommendedAds: fallbackAds,
                source: "fallback",
                reason: !aiAvailable ? "ai_service_unavailable" : "insufficient_user_data"
            });
        }

        // Prepare AI payload
        const adPayload = ads.map(ad => ({
            _id: ad._id.toString(),
            title: ad.title || "",
            description: ad.description || "",
            tags: ad.tags || [],
            category: ad.category ? ad.category.toString() : "",
            targetAudience: ad.targetAudience || "",
            image: ad.image || "",
            createdAt: ad.createdAt,
            totalCost: ad.totalCost || 0
        }));

        // Call AI service
        const response = await axios.post(`${AI_URL}/recommend_ads`, {
            ads: adPayload,
            user_activities: userProfile.activities,
            interests: userProfile.interests
        }, { timeout: 10000 });

        const recommendedIds = response.data.recommended_ads || [];

        let recommendedAds = [];
        if (recommendedIds.length > 0) {
            recommendedAds = await Advertisement.find({
                _id: { $in: recommendedIds },
                status: "approved",
                isActive: true
            });
        }

        // If AI returns insufficient results, supplement with fallback
        if (recommendedAds.length < 3) {
            console.log("AI returned insufficient results, supplementing with fallback");
            const supplementalAds = await getEnhancedFallbackAds(userId, 6 - recommendedAds.length);

            // Combine and remove duplicates
            const allAds = [...recommendedAds, ...supplementalAds];
            const uniqueAds = [];
            const seenIds = new Set();

            for (const ad of allAds) {
                if (!seenIds.has(ad._id.toString())) {
                    seenIds.add(ad._id.toString());
                    uniqueAds.push(ad);
                }
            }
            recommendedAds = uniqueAds;
        }

        res.json({
            message: "AI Recommended ads",
            count: recommendedAds.length,
            recommendedAds: recommendedAds,
            source: "ai",
            strategy: response.data.strategy_used || "ai_enhanced",
            userData: {
                activitiesCount: userProfile.activities.length,
                interestsTerms: userProfile.interests.split(' ').length
            }
        });

    } catch (error) {
        console.error("AI Ad Recommendation Error:", error.message);

        // Use fallback on any error
        const fallbackAds = await getEnhancedFallbackAds(userId);

        res.json({
            message: "Ad Recommendations (Fallback - Error)",
            count: fallbackAds.length,
            recommendedAds: fallbackAds,
            source: "fallback_error",
            error: error.message
        });
    }
});

// Health check
router.get("/health", async (req, res) => {
    try {
        const aiAvailable = await isAdAIServiceAvailable();
        const activeAdsCount = await Advertisement.countDocuments({
            status: "approved",
            isActive: true
        });

        res.json({
            ai_service_available: aiAvailable,
            active_ads_count: activeAdsCount,
            service: "ad_ai_recommendation",
            status: "operational"
        });
    } catch (error) {
        res.json({
            ai_service_available: false,
            service: "ad_ai_recommendation",
            error: error.message
        });
    }
});

module.exports = router;