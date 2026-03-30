require("dotenv").config();
const express = require("express");
const serverless = require("serverless-http");
const cors = require("cors");

const connectDB = require("../../config/db");

// Routes Import
const authRoutes = require("../../routes/authRoutes");
const categoryRoutes = require("../../routes/categoryRoutes");
const productRoutes = require("../../routes/productRoutes");
const aiRecommendation = require("../../routes/productAiRecommendation");
const cartRoutes = require("../../routes/cartRoutes");
const orderRoutes = require("../../routes/orderRoutes");
const reviewRoutes = require("../../routes/ReviewRoutes");
const profileRoutes = require("../../routes/profileRoutes");
const adminRoutes = require("../../routes/adminRoutes");
const adRoutes = require("../../routes/adRoutes");
const adAIRoutes = require("../../routes/adAIroutes");
const pricingRoutes = require("../../routes/pricingRoutes");
const bulkPricingRoutes = require("../../routes/bulkPricingRoutes");
const activityRoutes = require("../../routes/activityRoutes");
const paymentRoutes = require("../../routes/paymentRoutes");
const contactRoutes = require("../../routes/contactRoute");
const uploadRoutes = require("../../routes/uploadRoutes");

const app = express();

// CORS configuration
const corsOptions = {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "User-Fingerprint"],
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        timestamp: new Date(),
        environment: process.env.NODE_ENV || "production",
        clientUrl: process.env.CLIENT_URL,
    });
});

// connect DB
connectDB();

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
app.use("/api/upload", uploadRoutes);

// Root route
app.get("/", (req, res) => {
    res.send(`API is running... Server URL: ${process.env.SERVER_URL}`);
});

module.exports.handler = serverless(app);