const express = require("express");
const router = express.Router();
const axios = require("axios");
const Advertisement = require("../models/ad");
const UserActivity = require("../models/userActivity");

// Ai advertisment
router.post("/recommend_ads/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        const ads = await Advertisement.find({ status: "approved" });

        //building interest
        const activity = await UserActivity.findOne({ user: userId })
            .populate("viewedProducts purchasedProducts", "title description tags");

        let userInterests = "";
        if (activity) {
            const allTexts = [];
            const products = [
                ...(activity.viewedProducts || []),
                ...(activity.purchasedProducts || [])
            ];
            products.forEach(p => {
                allTexts.push(p.title, p.description, ...(p.tags || []));
            });
            userInterests = allTexts.join(" ");
        }

        if (!userInterests) {
            return res.status(400).json({ message: "No user activity found" });
        }

        // making simple data to send to python
        const adPayload = ads.map(ad => ({
            _id: ad._id,
            title: ad.title,
            description: ad.description,
            tags: ad.tags || []
        }));

        // Sending request
        const response = await axios.post("http://127.0.0.1:5001/recommendations", {
            ads: adPayload,
            interests: userInterests
        });

        // Fetching ads (id and data)
        const recommendedIds = response.data.recommended_ads;
        const recommendedAds = await Advertisement.find({ _id: { $in: recommendedIds } });

        res.json({
            message: "Recommended ads fetched successfully",
            count: recommendedAds.length,
            recommendedAds
        });
    } catch (err) {
        console.error("AI Recommendation Error:", err.message);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
