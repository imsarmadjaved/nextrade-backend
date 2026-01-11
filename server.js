require("dotenv").config();
const express = require("express");
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

const app = express();

// CORS configuration
const corsOptions = {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "User-Fingerprint"],
    credentials: true
};

// Log CORS origin for debugging
console.log("CORS Origin:", process.env.CLIENT_URL);

app.use(cors(corsOptions));
app.use(express.json()); // Parse incoming JSON

// Health check
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        timestamp: new Date(),
        environment: process.env.NODE_ENV || "development",
        clientUrl: process.env.CLIENT_URL
    });
});

// Connect to DB
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

// Image uploading
app.use("/api/upload", uploadRoutes);

// Test route
app.get("/", (req, res) => {
    res.send(`API is running... Server URL: ${process.env.SERVER_URL}`);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`Client URL: ${process.env.CLIENT_URL}`);
    console.log(`Server URL: ${process.env.SERVER_URL}`);
});