const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
    const authHeader = req.header("Authorization");
    if (!authHeader) return res.status(401).json({ message: "Access denied. No token provided." });

    const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified; // { id: ..., role: ... }
        next();
    } catch {
        res.status(400).json({ message: "Invalid token" });
    }
};
