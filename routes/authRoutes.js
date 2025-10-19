const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { registerUser, loginUser, forgotPassword, resetPassword } = require("../controllers/authController");
const router = express.Router();

//Register
router.post("/register", registerUser);

//Login
router.post("/login", loginUser);

//password Reset
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;
