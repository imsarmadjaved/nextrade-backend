const express = require("express");
const Payment = require("../models/payment");
const verifyToken = require("../middleware/authMiddleware");
const { uploadSingle } = require("../middleware/upload");
const roleCheck = require("../middleware/roleMiddleware");
const Ad = require("../models/ad");
const sendEmail = require("../utils/sendEmail");
const router = express.Router();

// Send Payment confirmation email
const sendPaymentConfirmationEmail = async (ad) => {
    if (!ad || !ad.seller || !ad.seller.email) {
        console.error("Cannot send email: Missing ad or seller email");
        return;
    }

    const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
                .success-box { background: #D1FAE5; padding: 15px; border-radius: 5px; margin: 15px 0; text-align: center; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Payment Received - Ad is Live!</h1>
                </div>
                <div class="content">
                    <p>Hello <strong>${ad.seller.name}</strong>,</p>
                    
                    <div class="success-box">
                        <h2>Your Ad is Now Active!</h2>
                        <p>We have received your payment and your advertisement is now live on our platform.</p>
                    </div>

                    <h3>Ad Details:</h3>
                    <ul>
                        <li><strong>Ad Title:</strong> ${ad.title}</li>
                        <li><strong>Duration:</strong> ${ad.duration} days</li>
                        <li><strong>Start Date:</strong> ${new Date(ad.startDate).toLocaleDateString()}</li>
                        <li><strong>End Date:</strong> ${new Date(ad.endDate).toLocaleDateString()}</li>
                        <li><strong>Amount Paid:</strong> Rs ${ad.totalCost}</li>
                    </ul>

                    <p>You can track your ad performance from your seller dashboard.</p>
                    
                    <p>Thank you for choosing NexTrade!</p>
                    
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
            subject: `Payment Confirmed - Your Ad "${ad.title}" is Live!`,
            message: emailHtml
        });
    } catch (error) {
        console.error("Failed to send payment confirmation email:", error);
    }
};

const sendAdRejectionEmail = async (ad, rejectionReason, isPaymentRejection = false) => {
    if (!ad || !ad.seller || !ad.seller.email) {
        console.error("Cannot send rejection email: Missing ad or seller email");
        return;
    }

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

// Upload payment proof (bank transfer)
router.post("/:paymentId/upload-proof",
    verifyToken,
    uploadSingle("image", "payments"),
    async (req, res) => {
        try {
            const payment = await Payment.findById(req.params.paymentId);
            if (!payment) return res.status(404).json({ message: "Payment not found" });

            if (payment.payer.toString() !== req.user.id) {
                return res.status(403).json({ message: "Not authorized" });
            }

            if (!["pending", "bank_transfer"].includes(payment.method)) {
                return res.status(400).json({
                    message: "Proof upload only allowed for bank transfers or pending payments."
                });
            }

            // Check if image was uploaded
            if (!req.file || !req.file.cloudinary) {
                return res.status(400).json({ message: "Valid image file is required." });
            }

            // Create image object in the same format as products
            const paymentProof = {
                url: req.file.cloudinary.url,
                publicId: req.file.cloudinary.publicId
            };

            // Store as array of image objects (for consistency with other models)
            payment.images = [paymentProof];

            if (payment.method === "pending") {
                payment.method = "bank_transfer";
            }

            payment.status = "processing";
            payment.paymentProof = paymentProof; // Also store single reference if needed
            await payment.save();

            res.json({
                message: "Payment proof uploaded successfully",
                image: paymentProof, // Return single image object
                payment
            });

        } catch (err) {
            res.status(500).json({ message: "Server error", error: err.message });
        }
    });

// Get payment proof image
router.get("/:paymentId/proof-image", verifyToken, async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.paymentId);
        if (!payment) return res.status(404).json({ message: "Payment not found" });

        // Check authorization
        if (payment.payer.toString() !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ message: "Not authorized" });
        }

        // Get image from images array (or fallback to paymentProof)
        let image = null;

        if (payment.images && payment.images.length > 0) {
            // Get first image from array
            image = payment.images[0];
        } else if (payment.paymentProof && typeof payment.paymentProof === 'object') {
            // Fallback to paymentProof field (for backward compatibility)
            image = payment.paymentProof;
        } else if (typeof payment.paymentProof === 'string') {
            // If it's stored as string URL (legacy format)
            image = {
                url: payment.paymentProof,
                publicId: null
            };
        }

        res.json({
            image,
            // Include payment info for context
            paymentId: payment._id,
            status: payment.status,
            method: payment.method
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get pending payments for admin
router.get("/admin/pending", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const pendingPayments = await Payment.find({
            status: { $in: ["pending", "processing"] },
            paymentFor: "ad"
        })
            .populate("payer", "name email")
            .populate({
                path: "itemId",
                select: "title totalCost status isActive",
                model: "Ad"
            })
            .sort({ createdAt: -1 });

        res.json({
            payments: pendingPayments,
            count: pendingPayments.length
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get payment statistics for admin
router.get("/admin/statistics", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const stats = await Payment.aggregate([
            {
                $match: { paymentFor: "ad" }
            },
            {
                $group: {
                    _id: null,
                    totalPayments: { $sum: 1 },
                    totalRevenue: { $sum: "$amount" },
                    awaitingPaymentCount: {
                        $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
                    },
                    pendingApprovalCount: {
                        $sum: { $cond: [{ $eq: ["$status", "processing"] }, 1, 0] }
                    },
                    completedPayments: {
                        $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
                    },
                    failedPayments: {
                        $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] }
                    }
                }
            }
        ]);

        // Get recent payments
        const recentPayments = await Payment.find({ paymentFor: "ad" })
            .populate("payer", "name email")
            .populate({
                path: "itemId",
                select: "title",
                model: "Ad"
            })
            .sort({ createdAt: -1 })
            .limit(10);

        res.json({
            ...(stats[0] || {
                totalPayments: 0,
                totalRevenue: 0,
                awaitingPaymentCount: 0,
                pendingApprovalCount: 0,
                completedPayments: 0,
                failedPayments: 0
            }),
            recentPayments: recentPayments
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Admin verify payment
router.put("/admin/:paymentId/verify", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.paymentId);
        if (!payment) {
            return res.status(404).json({ message: "Payment not found" });
        }

        // Update payment status
        payment.status = "completed";
        payment.verifiedAt = new Date();
        payment.verifiedBy = req.user.id;
        await payment.save();

        // Find and update the associated ad
        const ad = await Ad.findById(payment.itemId);
        if (ad) {
            ad.status = "approved";
            ad.payment = payment._id;
            ad.isActive = true;
            ad.approvedAt = new Date();
            await ad.save();

            // Send confirmation email
            await sendPaymentConfirmationEmail(ad);
        }

        res.json({
            message: "Payment verified successfully",
            payment,
            ad
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Admin reject payment
router.put("/admin/:paymentId/reject", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason) {
            return res.status(400).json({ message: "Rejection reason is required" });
        }

        const payment = await Payment.findById(req.params.paymentId);
        if (!payment) {
            return res.status(404).json({ message: "Payment not found" });
        }

        // Update payment status
        payment.status = "failed";
        payment.rejectionReason = reason;
        payment.verifiedAt = new Date();
        payment.verifiedBy = req.user.id;
        await payment.save();

        // Find and update the associated ad
        const ad = await Ad.findById(payment.itemId);
        if (ad) {
            ad.isActive = false;
            await ad.save();

            // Send rejection email
            await sendAdRejectionEmail(ad, reason, true);
        }

        res.json({
            message: "Payment rejected successfully",
            payment,
            ad
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get payment instructions
router.get("/instructions/:adId", verifyToken, async (req, res) => {
    try {
        const ad = await Ad.findById(req.params.adId);
        if (!ad) {
            return res.status(404).json({ message: "Ad not found" });
        }

        // Check authorization
        if (ad.createdBy.toString() !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ message: "Not authorized" });
        }

        const instructions = {
            bankName: "Sadapay",
            accountNumber: "+9230287900729",
            accountName: "Muhammad Sarmad Javed",
            amount: ad.totalCost,
            reference: `AD${ad._id}`,
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
            note: "Include reference number in payment remarks"
        };

        res.json(instructions);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get payment status for ad
router.get("/ad/:adId/status", verifyToken, async (req, res) => {
    try {
        const payment = await Payment.findOne({
            itemId: req.params.adId,
            paymentFor: "ad"
        });

        if (!payment) {
            return res.json({
                payment: { status: "not_initiated" }
            });
        }

        res.json({
            payment
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Initiate payment for ad
router.post("/ad/:adId/initiate", verifyToken, async (req, res) => {
    try {
        const { amount, method = "bank_transfer" } = req.body;
        const adId = req.params.adId;

        const ad = await Ad.findById(adId);
        if (!ad) {
            return res.status(404).json({ message: "Ad not found" });
        }

        // Check if ad belongs to user
        if (ad.createdBy.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not authorized" });
        }

        // Check if payment already exists
        let payment = await Payment.findOne({ itemId: adId, paymentFor: "ad" });

        if (!payment) {
            // Create new payment
            payment = new Payment({
                amount: amount || ad.totalCost,
                method,
                status: "pending",
                paymentFor: "ad",
                itemId: adId,
                payer: req.user.id
            });

            await payment.save();
        }

        // Link payment to ad
        ad.payment = payment._id;
        await ad.save();

        res.json({
            message: "Payment initiated successfully",
            payment
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;