const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");
const Goal = require("../models/Goal");
const Debt = require("../models/Debt");
const protect = require("../middleware/authMiddleware");
const publicUser = require("../utils/publicUser");
const otp = require("../utils/otp");
const { normalizePhone, maskPhone, maskEmail } = require("../utils/phone");

const router = express.Router();

// Every route in this file needs a logged-in user (mounted at /api/account)
router.use(protect);

// ===============================
// GET MY ACCOUNT  (fresh copy from the database)
// ===============================
router.get("/me", async (req, res) => {
    try {
        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(401).json({ message: "Account not found. Please log in again." });
        }

        res.json({ user: publicUser(user) });
    } catch (error) {
        console.error("Get account error:", error.message);
        res.status(500).json({ message: "Server error while loading your account." });
    }
});

// ===============================
// UPDATE PROFILE  (name, phone, CashBook name)
// The email address is the account's identity, so it is not changed here.
// ===============================
router.put("/profile", async (req, res) => {
    try {
        const fullName = String(req.body.fullName || "").trim();
        const mobileInput = String(req.body.mobile || "").trim();
        const book = String(req.body.book || "").trim();

        if (!fullName || !book) {
            return res.status(400).json({
                message: "Full name and CashBook name are required."
            });
        }

        if (fullName.length > 80 || book.length > 80) {
            return res.status(400).json({ message: "Names must be 80 characters or fewer." });
        }

        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(401).json({ message: "Account not found. Please log in again." });
        }

        // Accounts made with email and password need a phone number
        if (!mobileInput && !user.googleId) {
            return res.status(400).json({ message: "Mobile number is required." });
        }

        // Saved in one standard format (+234...) so login works with any spelling of it
        const mobile = mobileInput ? normalizePhone(mobileInput) : "";

        if (mobileInput && !mobile) {
            return res.status(400).json({
                message: "Please enter a valid mobile number, for example 08012345678 or +2348012345678."
            });
        }

        // Login accepts a phone number, so it must belong to one account only
        if (mobile) {
            const taken = await User.findOne({ mobile, _id: { $ne: user._id } });

            if (taken) {
                return res.status(400).json({
                    message: "That mobile number is already used by another account."
                });
            }
        }

        // A different number has not been verified yet
        if (mobile !== (user.mobile || "")) {
            user.mobileVerified = false;
        }

        user.fullName = fullName;
        user.mobile = mobile;
        user.book = book;
        await user.save();

        res.json({
            message: "Profile updated successfully.",
            user: publicUser(user)
        });
    } catch (error) {
        console.error("Update profile error:", error.message);
        res.status(500).json({ message: "Server error while saving your profile." });
    }
});

// ===============================
// VERIFY EMAIL OR PHONE (for an account that is already signed up)
// Step 1: send a code to the account's own email or phone number
// ===============================
router.post("/verify/send", async (req, res) => {
    try {
        const channel = req.body.channel === "phone" ? "phone" : req.body.channel === "email" ? "email" : "";

        if (!channel) {
            return res.status(400).json({ message: "Choose email or phone." });
        }

        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(401).json({ message: "Account not found. Please log in again." });
        }

        const destination = channel === "email" ? user.email : user.mobile;

        if (!destination) {
            return res.status(400).json({ message: "Add a phone number to your profile first." });
        }

        if ((channel === "email" && user.emailVerified) || (channel === "phone" && user.mobileVerified)) {
            return res.status(400).json({ message: "This is already verified." });
        }

        const key = String(user._id);
        const wait = await otp.waitSeconds("verify", key);

        if (wait > 0) {
            return res.status(429).json({
                message: "Please wait " + wait + " seconds before asking for another code.",
                resendIn: wait
            });
        }

        try {
            await otp.issue({ purpose: "verify", key, channel, destination });
        } catch (error) {
            console.error("Could not send verification code:", error.message);
            return res.status(502).json({ message: "We could not send the code right now. Please try again." });
        }

        const masked = channel === "email" ? maskEmail(destination) : maskPhone(destination);

        res.json({
            message: "We sent a 6-digit code to " + masked + ".",
            channel,
            sentTo: masked,
            resendIn: otp.RESEND_WAIT_SEC
        });

    } catch (error) {
        console.error("Verify send error:", error.message);
        res.status(500).json({ message: "Server error. Please try again." });
    }
});

// Step 2: check the code
router.post("/verify/confirm", async (req, res) => {
    try {
        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(401).json({ message: "Account not found. Please log in again." });
        }

        const key = String(user._id);
        const result = await otp.check("verify", key, req.body.code);

        if (!result.ok) {
            return res.status(400).json({ message: result.message });
        }

        const { channel, destination } = result.row;

        // The code was for an address / number that has since been changed
        if (destination !== (channel === "email" ? user.email : user.mobile)) {
            await otp.consume("verify", key);
            return res.status(400).json({ message: "That code was for a different number. Please request a new one." });
        }

        if (channel === "email") user.emailVerified = true;
        else user.mobileVerified = true;

        await user.save();
        await otp.consume("verify", key);

        res.json({
            message: (channel === "email" ? "Email" : "Phone number") + " verified.",
            user: publicUser(user)
        });

    } catch (error) {
        console.error("Verify confirm error:", error.message);
        res.status(500).json({ message: "Server error. Please try again." });
    }
});

// ===============================
// CHANGE PASSWORD  (or set one, for accounts created with Google)
// ===============================
router.put("/change-password", async (req, res) => {
    try {
        const currentPassword = String(req.body.currentPassword || "");
        const newPassword = String(req.body.newPassword || "");

        if (newPassword.length < 6) {
            return res.status(400).json({
                message: "New password must be at least 6 characters."
            });
        }

        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(401).json({ message: "Account not found. Please log in again." });
        }

        // Accounts that already have a password must prove they know it
        if (user.password) {
            if (!currentPassword) {
                return res.status(400).json({ message: "Please enter your current password." });
            }

            const correct = await bcrypt.compare(currentPassword, user.password);

            if (!correct) {
                return res.status(400).json({ message: "Your current password is not correct." });
            }

            if (currentPassword === newPassword) {
                return res.status(400).json({
                    message: "Your new password must be different from the current one."
                });
            }
        }

        const hadPassword = Boolean(user.password);

        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({
            message: hadPassword
                ? "Password changed successfully."
                : "Password set. You can now log in with your email and password too.",
            user: publicUser(user)
        });
    } catch (error) {
        console.error("Change password error:", error.message);
        res.status(500).json({ message: "Server error while changing your password." });
    }
});

// ===============================
// DELETE ACCOUNT  (removes the user and ALL of their records)
// The caller must send confirm: "DELETE", plus their password if they have one.
// ===============================
router.delete("/", async (req, res) => {
    try {
        const confirm = String((req.body && req.body.confirm) || "");
        const password = String((req.body && req.body.password) || "");

        if (confirm !== "DELETE") {
            return res.status(400).json({ message: 'Type DELETE to confirm.' });
        }

        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(401).json({ message: "Account not found. Please log in again." });
        }

        if (user.password) {
            const correct = password && await bcrypt.compare(password, user.password);

            if (!correct) {
                return res.status(400).json({ message: "Your password is not correct." });
            }
        }

        await Transaction.deleteMany({ user: user._id });
        await Budget.deleteMany({ user: user._id });
        await Goal.deleteMany({ user: user._id });
        await Debt.deleteMany({ user: user._id });
        await User.deleteOne({ _id: user._id });

        res.json({ message: "Your account and all of its records have been deleted." });
    } catch (error) {
        console.error("Delete account error:", error.message);
        res.status(500).json({ message: "Server error while deleting your account." });
    }
});

module.exports = router;
