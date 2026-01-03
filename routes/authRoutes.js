const express = require("express");
const verifyToken = require("../middleware/authMiddleware");
const {
    registerUser,
    loginUser,
    forgotPassword,
    resetPassword,
    changePassword,
    logout,
    validateResetToken,
    applyAsSeller
} = require("../controllers/authController");
const router = express.Router();

// Register
router.post("/register", registerUser);

// Login
router.post("/login", loginUser);

// Apply to Become Seller
router.post("/apply-seller", verifyToken, applyAsSeller);

// Change Password
router.post("/change-password", verifyToken, changePassword);

// Logout
router.post("/logout", verifyToken, logout);

// Password Reset
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/validate-reset-token/:token", validateResetToken);

module.exports = router;
