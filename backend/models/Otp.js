const mongoose = require("mongoose");

// One row = one verification code that is waiting to be entered.
//
//  purpose "signup": key is the email; payload holds the sign-up details
//                    (the account is only created AFTER the code is correct).
//  purpose "verify": key is the user's id; proves an existing account's email or phone.
const otpSchema = new mongoose.Schema({
    purpose: { type: String, enum: ["signup", "verify"], required: true },
    key: { type: String, required: true },
    channel: { type: String, enum: ["email", "phone"], required: true },
    destination: { type: String, required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} }
});

// Only one waiting code per purpose + key
otpSchema.index({ purpose: 1, key: 1 }, { unique: true });

// MongoDB deletes the row automatically once expiresAt has passed
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Otp", otpSchema);
