const express = require("express");
const Ad = require("../models/ad");
const AdInteraction = require("../models/AdInteraction");
const { uploadSingle, uploadMultiple } = require("../middleware/upload");
const Payment = require("../models/payment");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");
const sendEmail = require("../utils/sendEmail");
const { getPaymentInstructions } = require("../utils/paymentInstructions");

// Create ad
router.post("/",
    verifyToken,
    roleCheck(["seller"]),
    uploadSingle("image", "ads"),
    async (req, res) => {
        try {
            // Check if image was uploaded
            if (!req.file || !req.file.cloudinary) {
                return res.status(400).json({ message: "Ad image required" });
            }

            const {
                title,
                description,
                link,
                targetCategory,
                startDate,
                endDate,
                duration,
                totalCost
            } = req.body;

            // Create image object (same format as products)
            const adImage = {
                url: req.file.cloudinary.url,
                publicId: req.file.cloudinary.publicId
            };

            const newAd = new Ad({
                title,
                description,
                images: [adImage], // Store as array with single image
                link,
                targetCategory,
                startDate,
                endDate,
                duration: parseInt(duration),
                totalCost: parseFloat(totalCost),
                seller: req.user.id,
                createdBy: req.user.id
            });

            await newAd.save();
            await newAd.populate('seller', 'name email');

            res.status(201).json({
                message: "Ad created successfully, pending approval",
                ad: newAd,
                image: adImage // Return single image object
            });
        } catch (err) {
            res.status(500).json({ message: "Server error", error: err.message });
        }
    });

// status update route
router.put("/:id/image",
    verifyToken,
    roleCheck(["seller", "admin"]),
    uploadSingle("image", "ads"),
    async (req, res) => {
        try {
            const ad = await Ad.findById(req.params.id);
            if (!ad) {
                return res.status(404).json({ message: "Ad not found" });
            }

            // Check authorization
            if (req.user.role !== "admin" && ad.seller.toString() !== req.user.id) {
                return res.status(403).json({ message: "Not authorized to update this ad" });
            }

            // Check if ad can be updated
            if (ad.isActive) {
                return res.status(400).json({
                    message: "Cannot update image of an active ad"
                });
            }

            if (ad.status === "rejected") {
                return res.status(400).json({
                    message: "Cannot update image of a rejected ad"
                });
            }

            // Check if new image was uploaded
            if (!req.file || !req.file.cloudinary) {
                return res.status(400).json({ message: "No image provided" });
            }

            // Create new image object
            const newImage = {
                url: req.file.cloudinary.url,
                publicId: req.file.cloudinary.publicId
            };

            // Store old image for cleanup
            const oldImage = ad.images && ad.images.length > 0 ? ad.images[0] : null;

            // Update ad with new single image in array
            ad.images = [newImage];
            ad.updatedAt = new Date();

            await ad.save();

            res.json({
                message: "Ad image updated successfully",
                image: newImage // Return the image object
            });
        } catch (err) {
            res.status(500).json({ message: "Server error", error: err.message });
        }
    });

// Email for approved ads with payment instructions
const sendAdApprovalEmail = async (ad) => {
    const paymentInstructions = getPaymentInstructions(ad);

    const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
                .payment-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #4F46E5; }
                .important { background: #FFF3CD; padding: 15px; border-radius: 5px; border: 1px solid #FFEAA7; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Your Ad Has Been Approved!</h1>
                </div>
                <div class="content">
                    <p>Hello <strong>${ad.seller.name}</strong>,</p>
                    
                    <p>Great news! Your advertisement <strong>"${ad.title}"</strong> has been approved by our admin team.</p>
                    
                    <h3>Ad Details:</h3>
                    <ul>
                        <li><strong>Title:</strong> ${ad.title}</li>
                        <li><strong>Duration:</strong> ${ad.duration} days</li>
                        <li><strong>Total Amount:</strong> Rs ${ad.totalCost}</li>
                        <li><strong>Reference ID:</strong> AD${ad._id}</li>
                    </ul>

                    <div class="payment-details">
                        <h3>Payment Instructions</h3>
                        <p>Please make the payment to activate your ad:</p>
                        
                        <h4>Bank Transfer:</h4>
                        <ul>
                            <li><strong>Bank Name:</strong> ${paymentInstructions.bankName}</li>
                            <li><strong>Account Number:</strong> ${paymentInstructions.accountNumber}</li>
                            <li><strong>Account Name:</strong> ${paymentInstructions.accountName}</li>
                        </ul>
                        
                        <p><strong>Amount to Pay:</strong> Rs ${paymentInstructions.amount}</p>
                    </div>

                    <div class="important">
                        <h4>Important Instructions:</h4>
                        <ul>
                            <li>Include reference number <strong>AD${ad._id}</strong> in payment remarks</li>
                            <li>Payment due date: <strong>${new Date(paymentInstructions.dueDate).toLocaleDateString()}</strong></li>
                            <li>After payment, upload the screenshot on your advertisment page</li>
                            <li>Your ad will go live within 24 hours of payment confirmation</li>
                        </ul>
                    </div>

                    <p>If you have any questions, please contact our support team.</p>
                    
                    <p>Best regards,<br>NexTrade Team</p>
                </div>
                <div class="footer">
                    <p>This is an automated email. Please do not reply to this message.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    try {
        await sendEmail({
            email: ad.seller.email,
            subject: `Ad Approved: ${ad.title} - Payment Required`,
            message: emailHtml
        });
    } catch (error) {
        console.error("Failed to send approval email:", error);
    }
};

// Email for rejected ads
const sendAdRejectionEmail = async (ad, rejectionReason, isPaymentRejection = false) => {
    const subject = isPaymentRejection
        ? `Payment Rejected: ${ad.title}`
        : `Ad Not Approved: ${ad.title}`;

    const headerText = isPaymentRejection
        ? "Payment Review Update"
        : "Ad Review Update";

    const mainMessage = isPaymentRejection
        ? `We regret to inform you that your payment for advertisement <strong>"${ad.title}"</strong> has been rejected by our admin team.`
        : `We regret to inform you that your advertisement <strong>"${ad.title}"</strong> has not been approved.`;

    const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #DC2626; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
                .rejection-reason { background: #FEE2E2; padding: 15px; border-radius: 5px; margin: 15px 0; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>${headerText}</h1>
                </div>
                <div class="content">
                    <p>Hello <strong>${ad.seller.name}</strong>,</p>
                    
                    <p>${mainMessage}</p>
                    
                    ${ad.totalCost ? `<p><strong>Amount:</strong> Rs ${ad.totalCost}</p>` : ''}
                    
                    <div class="rejection-reason">
                        <h3>Reason for Rejection:</h3>
                        <p>${rejectionReason || "Does not meet our advertising guidelines"}</p>
                    </div>

                    ${isPaymentRejection
            ? `<p>You can upload a new payment proof or contact our support team for more details.</p>`
            : `<p>You can modify your ad and resubmit it for review, or contact our support team for more details.</p>`
        }
                    
                    <p>Best regards,<br>NexTrade Team</p>
                </div>
                <div class="footer">
                    <p>This is an automated email. Please do not reply to this message.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    try {
        await sendEmail({
            email: ad.seller.email,
            subject: subject,
            message: emailHtml
        });
    } catch (error) {
        console.error("Failed to send rejection email:", error);
    }
};

// View ads (Approved and active)
router.get("/:id/image", async (req, res) => {
    try {
        const ad = await Ad.findById(req.params.id);
        if (!ad) {
            return res.status(404).json({ message: "Ad not found" });
        }

        // Return image in consistent format
        let image = null;

        if (ad.images && ad.images.length > 0) {
            // Get first image from array
            image = ad.images[0];
        } else if (ad.image && typeof ad.image === 'string') {
            // Legacy format support
            image = {
                url: ad.image,
                publicId: null
            };
        }

        res.json({
            image,
            // Include ad info for context
            adId: ad._id,
            title: ad.title,
            status: ad.status
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// View all ads (admin)
router.get("/all", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const ads = await Ad.find()
            .populate("seller", "name email")
            .populate("targetCategory", "name")
            .populate("payment")
            .sort({ createdAt: -1 });

        res.json(ads);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get current seller's ads
router.get("/seller/me", verifyToken, roleCheck(["seller"]), async (req, res) => {
    try {
        const ads = await Ad.find({ createdBy: req.user.id })
            .populate("seller", "name email")
            .populate("payment")
            .sort({ createdAt: -1 });

        res.json(ads);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// View ads of a seller
router.get("/seller/:sellerId", verifyToken, roleCheck(["seller", "admin"]), async (req, res) => {
    try {
        const ads = await Ad.find({ createdBy: req.params.sellerId })
            .populate("seller", "name email")
            .populate("targetCategory", "name")
            .sort({ createdAt: -1 });

        if (!ads.length) {
            return res.status(404).json({ message: "No ads found for this seller" });
        }

        res.json(ads);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// View single ad data
router.get("/:id", async (req, res) => {
    try {
        const ad = await Ad.findById(req.params.id).populate("seller", "name email");

        if (!ad) {
            return res.status(404).json({ message: "Ad not found" });
        }

        res.json(ad);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Update ad status (admin only)
router.put("/:id/status", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const { status, rejectionReason } = req.body;
        const adId = req.params.id;

        // Validate status
        const validStatuses = ["pending", "approved", "rejected"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid status value" });
        }

        const ad = await Ad.findById(adId).populate('seller', 'name email');

        if (!ad) {
            return res.status(404).json({ message: "Ad not found" });
        }

        // Store old status for comparison
        const oldStatus = ad.status;

        // Update status
        ad.status = status;
        ad.updatedAt = new Date();

        // Handle rejected ads
        if (status === "rejected") {
            ad.rejectionReason = rejectionReason || "Does not meet our advertising guidelines";
            ad.isActive = false;
            ad.rejectedAt = new Date();

            // Send rejection email ASYNCHRONOUSLY
            sendAdRejectionEmail(ad, ad.rejectionReason, false).catch(error => {
                console.error("Failed to send rejection email:", error);
            });
        }

        // Handle approved ads
        if (status === "approved") {
            ad.approvedAt = new Date();
            ad.isActive = false; // Not active until payment is completed

            // Send approval email ASYNCHRONOUSLY (don't await)
            sendAdApprovalEmail(ad).catch(error => {
                console.error("Failed to send approval email:", error);
            });
        }

        await ad.save();

        // Return populated ad
        const updatedAd = await Ad.findById(adId)
            .populate('seller', 'name email')
            .populate('payment');

        res.json({
            message: `Ad status updated to ${status}`,
            ad: updatedAd,
            oldStatus,
            newStatus: status,
            // Add a note if email might be delayed
            emailSent: status === "approved" || status === "rejected"
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// for no-logged in user
router.get("/", async (req, res) => {
    try {
        const ads = await Ad.find({ isActive: true }).limit(10);
        res.json(ads);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch ads" });
    }
});

// Update ads
router.put("/:id", verifyToken, roleCheck(["seller", "admin"]), async (req, res) => {
    try {
        const { isActive, image, ...otherUpdates } = req.body;

        // Check if isActive is being sent in the request
        if (isActive !== undefined) {
            otherUpdates.isActive = isActive;
        }

        const ad = await Ad.findById(req.params.id)
            .populate('seller', 'name email')
            .populate('payment');

        if (!ad) {
            return res.status(404).json({ message: "Ad not found" });
        }

        // Check authorization
        if (req.user.role !== "admin" && ad.seller.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not authorized to update this ad" });
        }

        // Check if trying to activate ad
        if (isActive === true) {
            // Check if ad is approved and payment is completed
            if (ad.status !== "approved") {
                return res.status(400).json({
                    message: "Cannot activate ad. Ad must be approved first."
                });
            }

            // Check if payment exists and is completed
            if (!ad.payment) {
                return res.status(400).json({
                    message: "Cannot activate ad. Payment not found."
                });
            }

            if (ad.payment.status !== "completed") {
                return res.status(400).json({
                    message: `Cannot activate ad. Payment status is ${ad.payment.status}. Payment must be completed.`
                });
            }
        }

        // Handle image update
        if (image) {
            let imageArray = [];

            if (Array.isArray(image)) {
                // If array is sent, convert to proper format
                imageArray = image.map(img => {
                    if (typeof img === 'string') {
                        return {
                            url: img,
                            publicId: null
                        };
                    } else if (img && typeof img === 'object' && img.url) {
                        return {
                            url: img.url,
                            publicId: img.publicId || null
                        };
                    }
                    return null;
                }).filter(img => img !== null);
            } else if (typeof image === 'string') {
                // Single image URL string
                imageArray = [{
                    url: image,
                    publicId: null
                }];
            } else if (image && typeof image === 'object' && image.url) {
                // Single image object
                imageArray = [{
                    url: image.url,
                    publicId: image.publicId || null
                }];
            }

            if (imageArray.length > 0) {
                otherUpdates.images = imageArray;
            }
        }

        // Add updatedAt timestamp
        otherUpdates.updatedAt = new Date();

        // Update the ad with all fields
        const updatedAd = await Ad.findByIdAndUpdate(
            req.params.id,
            otherUpdates,
            { new: true }
        ).populate('seller', 'name email').populate('payment');

        if (!updatedAd) {
            return res.status(404).json({ message: "Ad not found" });
        }

        res.json({
            message: "Ad updated successfully",
            ad: updatedAd,
            // Return images in consistent format
            images: updatedAd.images || []
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Track ad impression
router.post("/:id/impression", async (req, res) => {
    try {
        const adId = req.params.id;
        const userFingerprint = req.headers['user-fingerprint'] ||
            req.headers['user-agent'] + req.ip; // Fallback
        const today = new Date().toDateString();

        const ad = await Ad.findById(adId);
        if (!ad) {
            return res.status(404).json({ message: "Ad not found" });
        }

        // Check if this user already viewed this ad today
        const existingInteraction = await AdInteraction.findOne({
            ad: adId,
            userIdentifier: userFingerprint,
            type: 'impression',
            date: {
                $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                $lt: new Date(new Date().setHours(23, 59, 59, 999))
            }
        });

        if (!existingInteraction) {
            // First impression from this user today
            ad.impressions = (ad.impressions || 0) + 1;

            await AdInteraction.create({
                ad: adId,
                userIdentifier: userFingerprint,
                type: 'impression',
                date: new Date()
            });

            // Calculate CTR
            if (ad.impressions > 0 && ad.clicks > 0) {
                ad.ctr = ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0;
            } else {
                ad.ctr = 0;
            }

            await ad.save();
        }

        res.json({
            message: "Impression recorded",
            impressions: ad.impressions,
            clicks: ad.clicks,
            ctr: ad.ctr,
            isNewImpression: !existingInteraction
        });
    } catch (err) {
        console.error("ERROR in impression tracking:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Track ad click
router.post("/:id/click", async (req, res) => {
    try {
        const adId = req.params.id;
        const userFingerprint = req.headers['user-fingerprint'] ||
            req.headers['user-agent'] + req.ip;
        const today = new Date().toDateString();

        const ad = await Ad.findById(adId);
        if (!ad) {
            return res.status(404).json({ message: "Ad not found" });
        }

        // Check if this user already clicked this ad today
        const existingClick = await AdInteraction.findOne({
            ad: adId,
            userIdentifier: userFingerprint,
            type: 'click',
            date: {
                $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                $lt: new Date(new Date().setHours(23, 59, 59, 999))
            }
        });

        if (!existingClick) {
            // First click from this user today
            ad.clicks = (ad.clicks || 0) + 1;

            await AdInteraction.create({
                ad: adId,
                userIdentifier: userFingerprint,
                type: 'click',
                date: new Date()
            });

            // Calculate CTR
            if (ad.impressions > 0 && ad.clicks > 0) {
                ad.ctr = (ad.clicks / ad.impressions) * 100;
            } else {
                ad.ctr = 0;
            }

            await ad.save();
        }

        res.json({
            message: "Click recorded",
            clicks: ad.clicks,
            impressions: ad.impressions,
            ctr: ad.ctr,
            isNewClick: !existingClick
        });
    } catch (err) {
        console.error("ERROR in click tracking:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get ad analytics (for sellers/admins)
router.get("/:id/analytics", verifyToken, roleCheck(["seller", "admin"]), async (req, res) => {
    try {
        const adId = req.params.id;
        const { period = '7d' } = req.query;

        const ad = await Ad.findById(adId);
        if (!ad) {
            return res.status(404).json({ message: "Ad not found" });
        }

        // Check if user owns the ad or is admin
        if (req.user.role !== "admin" && ad.createdBy.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not authorized" });
        }

        // Check if ad is rejected
        if (ad.status === "rejected") {
            return res.status(400).json({
                message: "This ad has been rejected. No analytics available."
            });
        }

        // Calculate date range based on period
        let startDate;
        const endDate = new Date();

        switch (period) {
            case '7d':
                startDate = new Date(endDate);
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30d':
                startDate = new Date(endDate);
                startDate.setDate(startDate.getDate() - 30);
                break;
            default:
                startDate = new Date(0); // Beginning of time
        }

        // Get unique user counts
        const uniqueViewers = await AdInteraction.distinct('userIdentifier', {
            ad: adId,
            type: 'impression',
            date: { $gte: startDate, $lte: endDate }
        });

        const uniqueClickers = await AdInteraction.distinct('userIdentifier', {
            ad: adId,
            type: 'click',
            date: { $gte: startDate, $lte: endDate }
        });

        // Get daily stats for the period
        const dailyStats = await AdInteraction.aggregate([
            {
                $match: {
                    ad: adId,
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                        type: "$type"
                    },
                    count: { $sum: 1 },
                    uniqueUsers: { $addToSet: "$userIdentifier" }
                }
            },
            {
                $group: {
                    _id: "$_id.date",
                    impressions: {
                        $sum: {
                            $cond: [{ $eq: ["$_id.type", "impression"] }, "$count", 0]
                        }
                    },
                    clicks: {
                        $sum: {
                            $cond: [{ $eq: ["$_id.type", "click"] }, "$count", 0]
                        }
                    },
                    uniqueImpressions: {
                        $sum: {
                            $cond: [{ $eq: ["$_id.type", "impression"] }, { $size: "$uniqueUsers" }, 0]
                        }
                    },
                    uniqueClicks: {
                        $sum: {
                            $cond: [{ $eq: ["$_id.type", "click"] }, { $size: "$uniqueUsers" }, 0]
                        }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const analytics = {
            // Basic stats
            impressions: ad.impressions || 0,
            clicks: ad.clicks || 0,
            ctr: ad.ctr || 0,

            // Unique user stats
            uniqueViewers: uniqueViewers.length,
            uniqueClickers: uniqueClickers.length,
            uniqueCTR: uniqueClickers.length > 0 ? (uniqueClickers.length / uniqueViewers.length * 100).toFixed(2) : 0,

            // Period-specific stats
            period: period,
            dailyStats: dailyStats,

            // Ad info
            status: ad.status,
            isActive: ad.isActive,
            startDate: ad.startDate,
            endDate: ad.endDate
        };

        res.json(analytics);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
