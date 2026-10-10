const nodemailer = require("nodemailer");

// Email sending, with three modes (chosen automatically from .env):
//
// 1. BREVO_API_KEY set       -> sends over HTTPS with the Brevo API. Works on Render's
//                               free tier (which blocks SMTP) and can send to ANY address
//                               once your sender address is verified in Brevo.
// 2. RESEND_API_KEY set      -> sends over HTTPS with the Resend API. Its free test
//                               sender only delivers to your own Resend account email.
// 3. EMAIL_USER + EMAIL_PASS -> sends with Gmail SMTP (works on your own computer).
// 4. None set                -> prints the message in the terminal / server logs.
//
// If sending fails, the message is also printed in the logs so a reset link
// is never lost. (Remove that fallback in a real production system.)

function printMessage(label, { to, subject, text }) {
    console.log(`\n[${label}] Message that would be sent:`);
    console.log("To:      " + to);
    console.log("Subject: " + subject);
    console.log(text + "\n");
}

async function sendWithResend({ to, subject, html, text }) {
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            from: process.env.EMAIL_FROM || "CashBook <onboarding@resend.dev>",
            to: [to],
            subject,
            html,
            text
        })
    });

    if (!response.ok) {
        let detail = "";
        try { detail = JSON.stringify(await response.json()); } catch (e) { /* ignore */ }
        throw new Error(`Resend error ${response.status} ${detail}`);
    }
}

// "CashBook <me@example.com>" -> { name: "CashBook", email: "me@example.com" }
function parseSender(from) {
    const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from || "");
    if (match) return { name: match[1].trim() || "CashBook", email: match[2].trim() };
    return { name: "CashBook", email: String(from || "").trim() };
}

async function sendWithBrevo({ to, subject, html, text }) {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "api-key": process.env.BREVO_API_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({
            sender: parseSender(process.env.EMAIL_FROM),
            to: [{ email: to }],
            subject,
            htmlContent: html || ("<p>" + text + "</p>"),
            textContent: text
        })
    });

    if (!response.ok) {
        let detail = "";
        try { detail = JSON.stringify(await response.json()); } catch (e) { /* ignore */ }
        throw new Error(`Brevo error ${response.status} ${detail}`);
    }
}

async function sendWithGmail({ to, subject, html, text }) {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"CashBook" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text,
        html
    });
}

async function sendMail(message) {
    try {
        if (process.env.BREVO_API_KEY) {
            await sendWithBrevo(message);
            return { mode: "brevo" };
        }

        if (process.env.RESEND_API_KEY) {
            await sendWithResend(message);
            return { mode: "resend" };
        }

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            await sendWithGmail(message);
            return { mode: "gmail" };
        }

        printMessage("DEV MODE - email not configured", message);
        return { mode: "dev" };

    } catch (error) {
        printMessage("EMAIL FAILED - fallback", message);
        throw error;
    }
}

module.exports = sendMail;
module.exports.parseSender = parseSender;
