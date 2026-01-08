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

// Product  (Multiple)
router.post(
    "/products/multiple",
    verifyToken,
    roleCheck(["seller", "admin"]),
    uploadMultiple("images", "products", 10),
    (req, res) => {
        const images = req.cloudinaryFiles.map((img) => ({
            url: img.url,
            publicId: img.publicId
        }));

        res.json({
            message: "Images uploaded successfully",
            images: images,
            count: images.length,
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
