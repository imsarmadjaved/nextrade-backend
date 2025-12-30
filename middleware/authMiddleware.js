const jwt = require("jsonwebtoken");
const User = require("../models/User");

const verifyToken = async (req, res, next) => {
    const token = req.header("Authorization");

    if (!token) {
        return res.status(401).json({ message: "Access denied, no token provided" });
    }

    try {
        const decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);

        // Find user and check if token was issued after last logout
        const user = await User.findById(decoded.id).select("-password");

        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        // Check if token was issued before last logout
        if (user.lastLogoutAt && decoded.iat * 1000 < user.lastLogoutAt.getTime()) {
            return res.status(401).json({ message: "Token expired. Please login again." });
        }

        req.user = user;
        next();
    } catch (err) {
        res.status(400).json({ message: "Invalid token", error: err.message });
    }
};

module.exports = verifyToken;