const jwt = require("jsonwebtoken");
const User = require("../models/User");


//  JWT Authentication Middleware
//  Verifies and validates JWT tokens for protected routes

const verifyToken = async (req, res, next) => {
    const token = req.header("Authorization");

    // Check if token exists in request headers
    if (!token) {
        return res.status(401).json({ message: "Access denied, no token provided" });
    }

    try {
        // Remove 'Bearer ' prefix and verify token
        const decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);

        // Retrieve user from database (excluding password field)
        const user = await User.findById(decoded.id).select("-password");

        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        //  Check if token was issued before the user's last logout
        //  This prevents using old tokens after logout

        if (user.lastLogoutAt && decoded.iat * 1000 < user.lastLogoutAt.getTime()) {
            return res.status(401).json({ message: "Token expired. Please login again." });
        }

        // Attach authenticated user to request object
        req.user = user;
        next();
    } catch (err) {
        // Handle various JWT errors (expired, malformed, invalid signature)
        res.status(400).json({ message: "Invalid token", error: err.message });
    }
};

module.exports = verifyToken;