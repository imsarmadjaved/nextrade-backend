const express = require("express");
const upload = require("../middleware/upload");
const verifyToken = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");
const router = express.Router();

// Single file upload for products
router.post("/products/single", verifyToken, roleCheck(["seller", "admin"]), upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No image file provided" });
        }

        res.json({
            message: "Image uploaded successfully",
            imageUrl: req.file.path,
            publicId: req.file.public_id,
            secure_url: req.file.path
        });
    } catch (err) {
        res.status(500).json({ message: "Upload failed", error: err.message });
    }
}
);

// Multiple files upload for products
router.post(
    "/products/multiple",
    verifyToken,
    roleCheck(["seller", "admin"]),
    upload.array("images", 10),
    async (req, res) => {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ message: "No image files provided" });
            }

            const imageUrls = req.files.map(file => file.path);

            res.json({
                message: "Images uploaded successfully",
                imageUrls,
                count: imageUrls.length,
            });
        } catch (err) {
            res.status(500).json({ message: "Upload failed", error: err.message });
        }
    }
);

router.post(
    "/categories/single",
    verifyToken,
    roleCheck(["admin"]),
    upload.single("image"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: "No image file provided" });
            }

            res.json({
                message: "Category image uploaded successfully",
                imageUrl: req.file.path,
            });
        } catch (err) {
            res.status(500).json({ message: "Upload failed", error: err.message });
        }
    }
);

router.post(
    "/profile",
    verifyToken,
    upload.single("image"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: "No image file provided" });
            }

            res.json({
                message: "Profile image uploaded successfully",
                imageUrl: req.file.path,
            });
        } catch (err) {
            res.status(500).json({ message: "Upload failed", error: err.message });
        }
    }
);

//payment proof
router.post(
    "/payment/proof",
    verifyToken,
    upload.single("image"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: "No image file uploaded" });
            }

            res.json({
                message: "Payment proof uploaded successfully",
                imageUrl: req.file.path,
                publicId: req.file.public_id
            });
        } catch (error) {
            res.status(500).json({ message: "Failed to upload payment proof" });
        }
    }
);

module.exports = router;
