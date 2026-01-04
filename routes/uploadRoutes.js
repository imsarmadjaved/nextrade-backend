const express = require("express");
const verifyToken = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");
const { uploadSingle, uploadMultiple } = require("../middleware/upload");

const router = express.Router();

// CATEGORY
router.post(
    "/categories/single",
    verifyToken,
    roleCheck(["admin"]),
    uploadSingle("image", "categories"),
    (req, res) => {
        res.json({
            message: "Category image uploaded successfully",
            imageUrl: req.file.cloudinary.url,
            publicId: req.file.cloudinary.publicId,
        });
    }
);

// PRODUCT (single)
router.post(
    "/products/single",
    verifyToken,
    roleCheck(["seller", "admin"]),
    uploadSingle("image", "products"),
    (req, res) => {
        res.json({
            message: "Product image uploaded successfully",
            imageUrl: req.file.cloudinary.url,
            publicId: req.file.cloudinary.publicId,
        });
    }
);

router.post(
    "/products/multiple",
    upload.uploadMultiple("images", "products"),
    async (req, res) => {
        try {
            const uploadedImages = req.files.map((file) => ({
                url: file.path,        // Cloudinary secure_url
                publicId: file.public_id,
            }));

            res.json({
                imageUrls: uploadedImages.map((img) => img.url), // only URLs for frontend
                count: uploadedImages.length,
            });
        } catch (error) {
            console.error("Gallery upload error:", error);
            res.status(500).json({ message: "Failed to upload gallery images" });
        }
    }
);

// PRODUCT (multiple)
router.post(
    "/products/multiple",
    verifyToken,
    roleCheck(["seller", "admin"]),
    uploadMultiple("images", "products", 10),
    (req, res) => {
        res.json({
            message: "Images uploaded successfully",
            images: req.cloudinaryFiles,
        });
    }
);

// PROFILE
router.post(
    "/profile",
    verifyToken,
    uploadSingle("image", "profiles"),
    (req, res) => {
        res.json({
            message: "Profile image uploaded successfully",
            imageUrl: req.file.cloudinary.url,
        });
    }
);

// PAYMENT
router.post(
    "/payment/proof",
    verifyToken,
    uploadSingle("image", "payments"),
    (req, res) => {
        res.json({
            message: "Payment proof uploaded successfully",
            imageUrl: req.file.cloudinary.url,
        });
    }
);

module.exports = router;
