const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");


dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to DB
connectDB();

// Routes
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);
const categoryRoutes = require("./routes/categoryRoutes");
app.use("/api/categories", categoryRoutes);
const productRoutes = require("./routes/productRoutes");
app.use("/api/products", productRoutes);
const cartRoutes = require("./routes/cartRoutes");
app.use("/api/cart", cartRoutes);
const orderRoutes = require("./routes/orderRoutes");
app.use("/api/orders", orderRoutes);
const reviewRoutes = require("./routes/ReviewRoutes");
app.use("/api/reviews", reviewRoutes);
const profileRoutes = require("./routes/profileRoutes.js");
app.use("/api/profile", profileRoutes);
const adminRoutes = require("./routes/adminRoutes");
app.use("/api/admin", adminRoutes);

//uploaded images public
app.use("/uploads", express.static(__dirname + "/uploads"));

// Test route
app.get("/", (req, res) => {
    res.send("API is running...");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
