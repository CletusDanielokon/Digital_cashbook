require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/authRoutes");
const otpRoutes = require("./routes/otpRoutes");
const googleRoutes = require("./routes/googleRoutes");
const passwordRoutes = require("./routes/passwordRoutes");
const accountRoutes = require("./routes/accountRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const budgetRoutes = require("./routes/budgetRoutes");
const goalRoutes = require("./routes/goalRoutes");
const reportRoutes = require("./routes/reportRoutes");

const app = express();

// Render (and most hosts) sit behind a proxy. This lets the rate limiter
// see each visitor's real IP address instead of the proxy's.
app.set("trust proxy", 1);

// ---------- CORS ----------
// CORS_ORIGIN = the address(es) of your website, separated by commas.
// Example: https://my-cashbook-google.netlify.app
// If it is empty (local development) any website may call the API.
const allowedOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);

// Content-Disposition is exposed so the browser can read the report's file name
app.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    exposedHeaders: ["Content-Disposition"]
}));
app.use(express.json());

// ---------- Rate limiting ----------
function limiter(minutes, max, message) {
    return rateLimit({
        windowMs: minutes * 60 * 1000,
        limit: max,
        standardHeaders: true,
        legacyHeaders: false,
        message: { message }
    });
}

// Login, sign-up and Google sign-in: 30 tries per 15 minutes per visitor
app.use(
    ["/api/auth/login", "/api/auth/register", "/api/auth/google"],
    limiter(15, 30, "Too many attempts. Please wait a few minutes and try again.")
);

// Sending verification codes (these cost real SMS / email credit): 10 per hour per visitor
app.use(
    ["/api/auth/register/start", "/api/auth/register/resend", "/api/account/verify/send"],
    limiter(60, 10, "Too many code requests. Please try again in an hour.")
);

// Entering codes: 30 tries per 15 minutes per visitor (each code also dies after 5 wrong guesses)
app.use(
    ["/api/auth/register/verify", "/api/account/verify/confirm"],
    limiter(15, 30, "Too many attempts. Please wait a few minutes and try again.")
);

// Password reset emails: 8 per hour per visitor
app.use(
    ["/api/auth/forgot-password", "/api/auth/reset-password"],
    limiter(60, 8, "Too many reset attempts. Please try again in an hour.")
);

// Changing the password or deleting the account: 10 per 15 minutes
app.use(
    "/api/account/change-password",
    limiter(15, 10, "Too many attempts. Please wait a few minutes and try again.")
);
app.delete(
    "/api/account",
    limiter(15, 10, "Too many attempts. Please wait a few minutes and try again.")
);

// Report downloads build a file each time: 30 per 15 minutes per visitor
app.use(
    "/api/reports",
    limiter(15, 30, "Too many downloads. Please wait a few minutes and try again.")
);

// ---------- Routes ----------
app.use("/api/auth", authRoutes);
app.use("/api/auth", otpRoutes);
app.use("/api/auth", googleRoutes);
app.use("/api/auth", passwordRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/budget", budgetRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/reports", reportRoutes);

// Test route
app.get("/", (req, res) => {
    res.json({
        message: "CashBook (Google edition) backend is running successfully!"
    });
});

// Export the app so tests can use it without starting the server
module.exports = app;

// Connect to MongoDB, then start listening
if (require.main === module) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => {
            console.log("MongoDB connected successfully!");

            const PORT = process.env.PORT || 5000;

            app.listen(PORT, () => {
                console.log(`CashBook backend running on http://localhost:${PORT}`);

                // Verification codes need a way to reach people. Say clearly if one is missing.
                const hasEmail = process.env.BREVO_API_KEY || process.env.RESEND_API_KEY ||
                    (process.env.EMAIL_USER && process.env.EMAIL_PASS);

                if (!hasEmail) {
                    console.warn("WARNING: no email service is set up (BREVO_API_KEY / RESEND_API_KEY / EMAIL_USER+EMAIL_PASS). " +
                        "Email verification codes and reset links will only be printed in this log.");
                }

                if (!process.env.TERMII_API_KEY) {
                    console.warn("WARNING: TERMII_API_KEY is not set. Phone (SMS) verification codes will only be printed in this log.");
                }
            });
        })
        .catch((error) => {
            console.error("MongoDB connection failed:");
            console.error(error.message);
        });
}
