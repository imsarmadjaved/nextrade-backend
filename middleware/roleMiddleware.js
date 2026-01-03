const roleCheck = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
        }

        if (req.user.role === "seller_pending" && allowedRoles.includes("seller")) {
            return res.status(403).json({
                message: "Your seller application is pending approval."
            });
        }

        const userRole = req.user.role === "seller_approved" ? "seller" : req.user.role;

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                message: "Access denied."
            });
        }

        next();
    };
};

module.exports = roleCheck;
