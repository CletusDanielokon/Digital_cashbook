const express = require("express");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/user");
const publicUser = require("../utils/publicUser");

const router = express.Router();

// ===============================
// GOOGLE SIGN-IN / SIGN-UP
// The browser sends the Google ID token ("credential").
// The server verifies it with Google, then issues CashBook's own JWT.
// ===============================
router.post("/google", async (req, res) => {
    try {
        const clientId = process.env.GOOGLE_CLIENT_ID;

        if (!clientId) {
            return res.status(500).json({
                message: "Google sign-in is not configured on the server."
            });
        }

        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({
                message: "Missing Google credential."
            });
        }

        // Verify signature, expiry and that the token was issued for THIS app
        const client = new OAuth2Client(clientId);

        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: clientId
        });

        const payload = ticket.getPayload();

        if (!payload || !payload.email || !payload.email_verified) {
            return res.status(401).json({
                message: "Your Google email address is not verified."
            });
        }

        const email = payload.email.toLowerCase();

        let user = await User.findOne({
            $or: [{ googleId: payload.sub }, { email }]
        });

        if (user) {
            // Existing CashBook account with the same email: link it to Google
            let changed = false;

            if (!user.googleId) {
                user.googleId = payload.sub;
                changed = true;
            }

            // Google has confirmed this email address
            if (!user.emailVerified) {
                user.emailVerified = true;
                changed = true;
            }

            // Keep the Google profile photo up to date
            if (payload.picture && user.picture !== payload.picture) {
                user.picture = payload.picture;
                changed = true;
            }

            if (changed) {
                await user.save();
            }
        } else {
            user = await User.create({
                fullName: payload.name || email.split("@")[0],
                email,
                googleId: payload.sub,
                emailVerified: true,
                picture: payload.picture || ""
            });
        }

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            message: "Login successful!",
            token: token,
            user: publicUser(user)
        });

    } catch (error) {
        console.error("Google login error:", error.message);

        res.status(401).json({
            message: "Google sign-in failed. Please try again."
        });
    }
});

module.exports = router;
