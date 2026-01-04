const express = require("express");
const Payment = require("../models/payment");
const verifyToken = require("../middleware/authMiddleware");
const { uploadSingle } = require("../middleware/upload");
const router = express.Router();

// Upload payment proof (bank transfer)
router.post("/:paymentId/upload-proof", verifyToken, uploadSingle("image"), async (req, res) => {
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

        if (!req.file || !req.file.mimetype.startsWith("image/")) {
            return res.status(400).json({ message: "Valid image file is required." });
        }

        payment.proofImageUrl = req.file.path;
        if (payment.method === "pending") payment.method = "bank_transfer";
        payment.status = "processing";

        await payment.save();

        res.json({ message: "Payment proof uploaded successfully", payment });

    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
