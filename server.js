const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

// Routes Import
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const aiRecommendation = require("./routes/productAiRecommendation");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const reviewRoutes = require("./routes/ReviewRoutes");
const profileRoutes = require("./routes/profileRoutes");
const adminRoutes = require("./routes/adminRoutes");
const adRoutes = require("./routes/adRoutes");
const adAIRoutes = require("./routes/adAIroutes");
const pricingRoutes = require("./routes/pricingRoutes");
const bulkPricingRoutes = require("./routes/bulkPricingRoutes");
const activityRoutes = require("./routes/activityRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const contactRoutes = require('./routes/contactRoute');
const uploadRoutes = require("./routes/uploadRoutes");

dotenv.config();
const app = express();

// Middleware
app.use(cors({
    origin: "https://nextrade-frontend.vercel.app",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "User-Fingerprint"],
    credentials: true
}));
app.use(express.json()); // Parse incoming JSON

// Connect to DB
connectDB();

// Health check
app.get("/health", (req, res) => {
    res.status(200).send("OK");
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api", bulkPricingRoutes);
app.use("/api/products", productRoutes);
app.use("/api/ai/products", aiRecommendation);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ads", adRoutes);
app.use("/api/ai/ads", adAIRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/contact", contactRoutes);

// Image uploading
app.use("/api/upload", uploadRoutes);

// Test route
app.get("/", (req, res) => {
    res.send("API is running...");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
