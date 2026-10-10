const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Otp = require("../models/Otp");
const otp = require("../utils/otp");
const publicUser = require("../utils/publicUser");
const { normalizePhone, maskPhone, maskEmail } = require("../utils/phone");

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function destinationFor(method, email, mobile) {
    return method === "email" ? email : mobile;
}

function maskedFor(method, email, mobile) {
    return method === "email" ? maskEmail(email) : maskPhone(mobile);
}

// ===============================
// SIGN UP, STEP 1: check the details and send a code.
// No account is created yet, so a mistyped email or phone number
// never becomes an account that nobody can use.
// ===============================
router.post("/register/start", async (req, res) => {
    try {
        const fullName = String(req.body.fullName || "").trim();
        const book = String(req.body.book || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");
        const method = req.body.method === "phone" ? "phone" : req.body.method === "email" ? "email" : "";

        if (!fullName || !book || !email || !req.body.mobile || !password) {
            return res.status(400).json({ message: "Please fill in all fields." });
        }

        if (!method) {
            return res.status(400).json({ message: "Choose how to receive your code: email or phone." });
        }

        if (fullName.length > 80 || book.length > 80) {
            return res.status(400).json({ message: "Names must be 80 characters or fewer." });
        }

        if (!EMAIL_PATTERN.test(email)) {
            return res.status(400).json({ message: "Please enter a valid email address." });
        }

        const mobile = normalizePhone(req.body.mobile);

        if (!mobile) {
            return res.status(400).json({
                message: "Please enter a valid phone number, for example 08012345678 or +2348012345678."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters." });
        }

        if (await User.findOne({ email })) {
            return res.status(400).json({ message: "An account with this email already exists." });
        }

        if (await User.findOne({ mobile })) {
            return res.status(400).json({ message: "An account with this phone number already exists." });
        }

        const wait = await otp.waitSeconds("signup", email);

        if (wait > 0) {
            return res.status(429).json({
                message: "Please wait " + wait + " seconds before asking for another code.",
                resendIn: wait
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        try {
            await otp.issue({
                purpose: "signup",
                key: email,
                channel: method,
                destination: destinationFor(method, email, mobile),
                payload: { fullName, mobile, book, passwordHash }
            });
        } catch (error) {
            console.error("Could not send sign-up code:", error.message);
            return res.status(502).json({
                message: method === "email"
                    ? "We could not send the email right now. Check the address, or choose phone instead."
                    : "We could not send the text message right now. Check the number, or choose email instead."
            });
        }

        res.json({
            message: "We sent a 6-digit code to " + maskedFor(method, email, mobile) + ".",
            method,
            sentTo: maskedFor(method, email, mobile),
            resendIn: otp.RESEND_WAIT_SEC
        });

    } catch (error) {
        console.error("Register start error:", error.message);
        res.status(500).json({ message: "Server error during registration." });
    }
});

// ===============================
// SIGN UP: send the code again (optionally by the other method)
// ===============================
router.post("/register/resend", async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const row = await Otp.findOne({ purpose: "signup", key: email });

        if (!row || new Date(row.expiresAt).getTime() < Date.now()) {
            return res.status(400).json({ message: "Your sign-up has expired. Please fill in the form again." });
        }

        const method = req.body.method === "phone" ? "phone" : req.body.method === "email" ? "email" : row.channel;

        const wait = await otp.waitSeconds("signup", email);

        if (wait > 0) {
            return res.status(429).json({
                message: "Please wait " + wait + " seconds before asking for another code.",
                resendIn: wait
            });
        }

        const { mobile } = row.payload;

        try {
            await otp.issue({
                purpose: "signup",
                key: email,
                channel: method,
                destination: destinationFor(method, email, mobile),
                payload: row.payload
            });
        } catch (error) {
            console.error("Could not resend sign-up code:", error.message);
            return res.status(502).json({ message: "We could not send the code right now. Please try again." });
        }

        res.json({
            message: "We sent a new code to " + maskedFor(method, email, mobile) + ".",
            method,
            sentTo: maskedFor(method, email, mobile),
            resendIn: otp.RESEND_WAIT_SEC
        });

    } catch (error) {
        console.error("Register resend error:", error.message);
        res.status(500).json({ message: "Server error. Please try again." });
    }
});

// ===============================
// SIGN UP, STEP 2: check the code, then create the account and log in
// ===============================
router.post("/register/verify", async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();

        const result = await otp.check("signup", email, req.body.code);

        if (!result.ok) {
            return res.status(400).json({ message: result.message });
        }

        const { fullName, mobile, book, passwordHash } = result.row.payload;

        // Someone may have taken the email or number while the code was waiting
        if ((await User.findOne({ email })) || (await User.findOne({ mobile }))) {
            await otp.consume("signup", email);
            return res.status(400).json({ message: "An account with these details already exists." });
        }

        let user;

        try {
            user = await User.create({
                fullName,
                mobile,
                email,
                book,
                password: passwordHash,
                emailVerified: result.row.channel === "email",
                mobileVerified: result.row.channel === "phone"
            });
        } catch (error) {
            if (error && error.code === 11000) {
                await otp.consume("signup", email);
                return res.status(400).json({ message: "An account with this email already exists." });
            }
            throw error;
        }

        await otp.consume("signup", email);

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        res.status(201).json({
            message: "Account verified and created successfully!",
            token: token,
            user: publicUser(user)
        });

    } catch (error) {
        console.error("Register verify error:", error.message);
        res.status(500).json({ message: "Server error during registration." });
    }
});

module.exports = router;
