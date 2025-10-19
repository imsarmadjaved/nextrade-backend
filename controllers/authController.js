const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

//register
const registerUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Email already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role,
        });

        await newUser.save();

        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

//login
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

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
                role: user.role
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};


// Forgot Password (with email)
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString("hex");

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 mins
        await user.save();

        const resetUrl = `${process.env.CLIENT_URL}/api/auth/reset-password/${resetToken}`;

        const message = `
      <div style="font-family: Arial, sans-serif; padding: 10px;">
        <h2>Reset Your NexTrade Password</h2>
        <p>You requested a password reset. Click the button below to reset your password.</p>
        <a href="${resetUrl}" 
           style="display:inline-block; background-color:#4CAF50; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">
           Reset Password
        </a>
        <p>This link is valid for 10 minutes. If you didn’t request this, please ignore this email.</p>
      </div>
    `;

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

// Reset Password
const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpire: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired token" });
        }

        const bcrpt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, bcrpt);

        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save();

        res.json({ message: "Password reset successful!" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};


module.exports = { registerUser, loginUser, forgotPassword, resetPassword };
