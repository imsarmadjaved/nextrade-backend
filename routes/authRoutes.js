const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { registerUser, loginUser } = require("../controllers/authController");

const router = express.Router();

//Register
router.post("/register", registerUser);

//Login
router.post("/login", loginUser);

module.exports = router;
