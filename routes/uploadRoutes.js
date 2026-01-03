const express = require("express");
const { uploadSingle, uploadMultiple } = require("../middleware/upload");
const verifyToken = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");
const router = express.Router();

// Single file upload for products
router.post("/products/single", verifyToken, roleCheck(["seller", "admin"]), uploadSingle("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No image file provided" });
        }

        res.json({
            message: "Image uploaded successfully",
            imageUrl: req.file.cloudinary_url,
            publicId: req.file.cloudinary_id,
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
    uploadMultiple("images", "products", 10),
    async (req, res) => {
        if (!req.files_cloudinary || req.files_cloudinary.length === 0) {
            return res.status(400).json({ message: "No image files provided" });
        }
        const imageUrls = req.files_cloudinary.map(f => f.cloudinary_url);

        res.json({
            message: "Images uploaded successfully",
            imageUrls,
            count: imageUrls.length,
        });
    }
);

// catagories
router.post(
    "/categories/single",
    verifyToken,
    roleCheck(["admin"]),
    uploadSingle("image", "categories"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: "No image file provided" });
            }

            res.json({
                message: "Category image uploaded successfully",
                imageUrl: req.file.cloudinary_url,
            });
        } catch (err) {
            res.status(500).json({ message: "Upload failed", error: err.message });
        }
    }
);

//profile
router.post(
    "/profile",
    verifyToken,
    uploadSingle("image", "profiles"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: "No image file provided" });
            }

            res.json({
                message: "Profile image uploaded successfully",
                imageUrl: req.file.cloudinary_url,
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
    uploadSingle("image", "payments"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: "No image file uploaded" });
            }

            res.json({
                message: "Payment proof uploaded successfully",
                imageUrl: req.file.cloudinary_url,
                publicId: req.file.cloudinary_id
            });
        } catch (error) {
            res.status(500).json({ message: "Failed to upload payment proof" });
        }
    }
);

module.exports = router;
