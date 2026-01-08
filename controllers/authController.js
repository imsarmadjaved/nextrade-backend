const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const Profile = require("../models/Profile");
const sendEmail = require("../utils/sendEmail");

// User Registration Controller
const registerUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Email already registered" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Handle seller registration with pending status
        let userRole = role;
        let approvalStatus = "pending";

        if (role === "seller") {
            userRole = "seller_pending";
            approvalStatus = "pending";
        }

        // Create new user
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role: userRole,
            approvalStatus: approvalStatus,
            submittedAt: role === "seller" ? new Date() : undefined
        });

        await newUser.save();

        // Create empty user profile
        const newProfile = new Profile({
            user: newUser._id
        });
        await newProfile.save();

        res.status(201).json({
            message: "User registered successfully",
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                approvalStatus: newUser.approvalStatus
            }
        });
    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Apply to Become Seller Controller
const applyAsSeller = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Validate user's current status
        if (user.role === "seller_pending") {
            return res.status(400).json({ message: "Seller application already pending" });
        }

        if (user.role === "seller_approved") {
            return res.status(400).json({ message: "You are already an approved seller" });
        }

        // Update user to pending seller status
        user.role = "seller_pending";
        user.approvalStatus = "pending";
        user.submittedAt = new Date();

        await user.save();

        res.json({
            message: "Seller application submitted successfully. Please complete your business profile.",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                approvalStatus: user.approvalStatus
            }
        });

    } catch (error) {
        console.error("Apply as Seller Error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// User Login Controller
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        // Check if account is blocked
        if (user.isBlocked) {
            return res.status(403).json({
                message: "Your account has been blocked. Please contact administrator."
            });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                approvalStatus: user.approvalStatus,
                isBlocked: user.isBlocked
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// User Logout Controller
const logout = async (req, res) => {
    try {
        const userId = req.user.id;

        // Record logout timestamp
        await User.findByIdAndUpdate(userId, {
            lastLogoutAt: new Date()
        });

        res.json({
            message: "Logged out successfully",
            success: true
        });

    } catch (error) {
        console.error("Logout Error:", error);
        res.status(500).json({
            message: "Server error during logout",
            error: error.message
        });
    }
};

// Change Password Controller
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        // Validate input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                message: "Current password and new password are required"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                message: "New password must be at least 6 characters long"
            });
        }

        // Find user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ message: "Current password is incorrect" });
        }

        // Check if new password is same as current
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({
                message: "New password cannot be the same as current password"
            });
        }

        // Hash and update new password
        const saltRounds = 10;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

        user.password = hashedNewPassword;
        await user.save();

        res.json({
            message: "Password changed successfully"
        });

    } catch (error) {
        console.error("Change Password Error:", error);
        res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

// Forgot Password Controller
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Generate password reset token (valid for 10 minutes)
        const resetToken = crypto.randomBytes(32).toString("hex");

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
        await user.save();

        // Construct reset URL
        const resetUrl = `${process.env.CLIENT_URL || 'https://nextrade-frontend.vercel.app'}/reset-password/${resetToken}`;

        // Email template for password reset
        const message = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #4f46e5; margin-bottom: 10px;">Reset Your NexTrade Password</h2>
          <p style="color: #666; margin-bottom: 20px;">You requested a password reset. Click the button below to reset your password.</p>
        </div>
        
        <div style="text-align: center; margin: 25px 0;">
          <a href="${resetUrl}" 
             style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
             Reset Password
          </a>
        </div>
        
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin-top: 20px;">
          <p style="color: #666; margin: 0; font-size: 14px;">
            <strong>Important:</strong> This link will expire in 10 minutes.
          </p>
          <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">
            If you didn't request this password reset, please ignore this email.
          </p>
        </div>
        
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <p style="color: #999; font-size: 12px; margin: 0;">
            Or copy and paste this link in your browser:<br>
            <span style="color: #4f46e5; word-break: break-all;">${resetUrl}</span>
          </p>
        </div>
      </div>
    `;

        // Send password reset email
        await sendEmail({
            email: user.email,
            subject: "NexTrade Password Reset Request",
            message,
        });

        res.json({
            message: "Password reset link sent to your email address!",
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Reset Password Controller
const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;

        // Find user with valid reset token
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpire: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired token" });
        }

        // Hash new password and update user
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        // Clear reset token fields
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save();

        res.json({ message: "Password reset successful!" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Validate Reset Token Controller
const validateResetToken = async (req, res) => {
    try {
        const { token } = req.params;

        // Check token validity
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpire: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({
                valid: false,
                message: "Invalid or expired reset token"
            });
        }

        res.json({
            valid: true,
            message: "Valid reset token"
        });
    } catch (err) {
        res.status(500).json({
            valid: false,
            message: "Server error",
            error: err.message
        });
    }
};

// Export all authentication controllers
module.exports = {
    registerUser,
    loginUser,
    forgotPassword,
    resetPassword,
    changePassword,
    logout,
    validateResetToken,
    applyAsSeller
};