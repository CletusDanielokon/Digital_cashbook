const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const sendMail = require("../utils/mailer");

const router = express.Router();

const RESET_MINUTES = 15;

function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

// ===============================
// FORGOT PASSWORD  (step 1: email a reset link)
// ===============================
router.post("/forgot-password", async (req, res) => {
    // The same answer is always returned, so nobody can use this
    // route to find out which emails have an account.
    const genericReply = {
        message: "If an account exists for that email, a reset link has been sent."
    };

    try {
        const email = String(req.body.email || "").trim().toLowerCase();

        if (!email) {
            return res.status(400).json({
                message: "Please enter your email address."
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.json(genericReply);
        }

        // Random token: the plain version goes in the email,
        // only a hash of it is saved in the database.
        const token = crypto.randomBytes(32).toString("hex");

        user.resetPasswordToken = hashToken(token);
        user.resetPasswordExpires = new Date(Date.now() + RESET_MINUTES * 60 * 1000);
        await user.save();

        const frontend = (process.env.FRONTEND_URL || "http://127.0.0.1:5500").replace(/\/$/, "");
        const link = `${frontend}/reset-password.html?token=${token}`;

        const text =
            `Hello ${user.fullName},\n\n` +
            `Use the link below to choose a new CashBook password. ` +
            `It expires in ${RESET_MINUTES} minutes.\n\n${link}\n\n` +
            `If you did not ask for this, you can ignore this email.`;

        const html =
            `<div style="font-family:Arial,sans-serif;max-width:480px">` +
            `<h2 style="color:#0f172a">Reset your CashBook password</h2>` +
            `<p>Hello ${user.fullName},</p>` +
            `<p>Click the button below to choose a new password. ` +
            `The link expires in ${RESET_MINUTES} minutes.</p>` +
            `<p><a href="${link}" style="background:#22c55e;color:#fff;padding:12px 20px;` +
            `border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">` +
            `Reset Password</a></p>` +
            `<p style="color:#64748b;font-size:13px">If you did not ask for this, ignore this email.</p>` +
            `</div>`;

        try {
            await sendMail({
                to: user.email,
                subject: "Reset your CashBook password",
                text,
                html
            });
        } catch (mailError) {
            console.error("Reset email error:", mailError.message);
        }

        res.json(genericReply);

    } catch (error) {
        console.error("Forgot password error:", error.message);

        res.status(500).json({
            message: "Server error. Please try again."
        });
    }
});

// ===============================
// RESET PASSWORD  (step 2: set the new password)
// ===============================
router.post("/reset-password", async (req, res) => {
    try {
        const token = String(req.body.token || "");
        const password = String(req.body.password || "");

        if (!token || !password) {
            return res.status(400).json({
                message: "Reset token and new password are required."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters."
            });
        }

        const user = await User.findOne({
            resetPasswordToken: hashToken(token),
            resetPasswordExpires: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({
                message: "This reset link is invalid or has expired. Please request a new one."
            });
        }

        user.password = await bcrypt.hash(password, 10);
        // The reset link went to this email address, so using it proves the address is theirs
        user.emailVerified = true;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({
            message: "Password updated successfully. You can now log in."
        });

    } catch (error) {
        console.error("Reset password error:", error.message);

        res.status(500).json({
            message: "Server error. Please try again."
        });
    }
});

module.exports = router;
