const crypto = require("crypto");
const Otp = require("../models/Otp");
const sendMail = require("./mailer");
const sendSms = require("./sms");

const CODE_LIFETIME_MIN = 10;   // a code works for 10 minutes
const MAX_ATTEMPTS = 5;         // 5 wrong guesses and the code is destroyed
const RESEND_WAIT_SEC = 60;     // wait a minute between sends

// ---- codes -------------------------------------------------------------
function makeCode() {
    // crypto.randomInt is cryptographically secure (Math.random is not)
    return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

// Codes are stored hashed (HMAC with the server secret), like passwords
function hashCode(purpose, key, code) {
    return crypto
        .createHmac("sha256", process.env.JWT_SECRET || "dev-secret")
        .update(purpose + "|" + key + "|" + code)
        .digest("hex");
}

function sameHash(a, b) {
    const x = Buffer.from(a, "hex");
    const y = Buffer.from(b, "hex");
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ---- delivery (kept in an object so tests can replace it) ---------------
const delivery = {
    async send(channel, destination, code) {
        const text = "Your CashBook verification code is " + code +
            ". It expires in " + CODE_LIFETIME_MIN + " minutes. Do not share it with anyone.";

        if (channel === "email") {
            await sendMail({
                to: destination,
                subject: "Your CashBook verification code",
                text: text,
                html:
                    '<div style="font-family:Arial,sans-serif;max-width:420px">' +
                    "<h2>Verify your CashBook account</h2>" +
                    "<p>Your verification code is:</p>" +
                    '<p style="font-size:32px;letter-spacing:8px;font-weight:bold">' + code + "</p>" +
                    "<p>It expires in " + CODE_LIFETIME_MIN + " minutes. If you did not ask for it, ignore this email.</p>" +
                    "</div>"
            });
        } else {
            await sendSms(destination, text);
        }
    }
};

// ---- storing and checking ----------------------------------------------
// Create (or replace) the waiting code for purpose+key and send it.
// If sending fails the stored code is removed, so nothing is left behind.
async function issue({ purpose, key, channel, destination, payload }) {
    const code = makeCode();

    await Otp.findOneAndUpdate(
        { purpose, key },
        {
            purpose, key, channel, destination,
            codeHash: hashCode(purpose, key, code),
            attempts: 0,
            lastSentAt: new Date(),
            expiresAt: new Date(Date.now() + CODE_LIFETIME_MIN * 60 * 1000),
            payload: payload || {}
        },
        { upsert: true, new: true }
    );

    try {
        await delivery.send(channel, destination, code);
    } catch (error) {
        await Otp.deleteOne({ purpose, key });
        throw error;
    }
}

// Seconds the person must still wait before another code may be sent (0 = may send)
async function waitSeconds(purpose, key) {
    const row = await Otp.findOne({ purpose, key });
    if (!row) return 0;
    const passed = (Date.now() - new Date(row.lastSentAt).getTime()) / 1000;
    return passed >= RESEND_WAIT_SEC ? 0 : Math.ceil(RESEND_WAIT_SEC - passed);
}

// Returns { ok: true, row } or { ok: false, message }
async function check(purpose, key, code) {
    const row = await Otp.findOne({ purpose, key });

    if (!row || new Date(row.expiresAt).getTime() < Date.now()) {
        return { ok: false, message: "That code has expired. Please request a new one." };
    }

    const guess = String(code || "").trim();

    if (!/^[0-9]{6}$/.test(guess)) {
        return { ok: false, message: "Enter the 6-digit code." };
    }

    if (!sameHash(row.codeHash, hashCode(purpose, key, guess))) {
        row.attempts = (row.attempts || 0) + 1;

        if (row.attempts >= MAX_ATTEMPTS) {
            await Otp.deleteOne({ purpose, key });
            return { ok: false, message: "Too many wrong codes. Please request a new one." };
        }

        await row.save();
        return {
            ok: false,
            message: "Wrong code. " + (MAX_ATTEMPTS - row.attempts) + " attempt(s) left."
        };
    }

    return { ok: true, row };
}

async function consume(purpose, key) {
    await Otp.deleteOne({ purpose, key });
}

module.exports = { issue, check, consume, waitSeconds, delivery, RESEND_WAIT_SEC, CODE_LIFETIME_MIN };
