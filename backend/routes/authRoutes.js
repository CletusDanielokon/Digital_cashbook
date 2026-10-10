const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const publicUser = require("../utils/publicUser");
const { normalizePhone } = require("../utils/phone");

const router = express.Router();

// Sign-up now happens in routes/otpRoutes.js
// (/register/start -> /register/verify), so every new account has proved
// that its email or phone number is real before it is created.

// ===============================
// LOGIN USER
// ===============================
router.post("/login", async (req, res) => {
    try {
        const { identifier, password } = req.body;

        // Check that both fields were provided
        if (!identifier || !password) {
            return res.status(400).json({
                message: "Please enter your email/phone number and password."
            });
        }

        // Find user by email or mobile number (any common phone format works)
        const text = String(identifier).trim();
        const phone = normalizePhone(text);

        const user = await User.findOne({
            $or: [
                { email: text.toLowerCase() },
                ...(phone ? [{ mobile: phone }] : [])
            ]
        });

        // User not found
        if (!user) {
            return res.status(401).json({
                message: "Invalid email, phone number or password."
            });
        }

        // Account created with Google has no password yet
        if (!user.password) {
            return res.status(401).json({
                message: "This account uses Google sign-in. Click 'Continue with Google', or use 'Forgot Password?' to create a password."
            });
        }

        // Compare entered password with hashed password
        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email, phone number or password."
            });
        }

        // Create login token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        // Send successful login response
        res.json({
            message: "Login successful!",
            token: token,
            user: publicUser(user)
        });

    } catch (error) {
        console.error("Login error:", error.message);

        res.status(500).json({
            message: "Server error during login."
        });
    }
});
module.exports = router;