// Sends text messages and WhatsApp codes. Provider is chosen from .env:
//
//   TERMII_API_KEY set  -> sends with Termii (https://termii.com), a Nigerian messaging provider.
//        TERMII_BASE_URL     your account's own address, shown on your Termii dashboard
//                            (default https://api.ng.termii.com)
//        TERMII_SENDER_ID    sender name for SMS (must be registered / approved with Termii)
//        TERMII_CHANNEL      "generic" (default) or "dnd". Use "dnd" for verification codes:
//                            it reaches numbers on Do-Not-Disturb and has no night-time limit.
//                            Termii must switch the DND route on for your account first.
//        TERMII_WHATSAPP_DEVICE_ID    \  both needed to send codes on WhatsApp
//        TERMII_WHATSAPP_TEMPLATE_ID  /  (an approved WhatsApp "Authentication" template)
//   not set             -> prints the message in the terminal / server log (development)
//
// The phone number must already be in the standard "+234..." format.

function printMessage(to, text) {
    console.log("\n[DEV MODE - SMS not configured] Message that would be sent:");
    console.log("To:   " + to);
    console.log(text + "\n");
}

function baseUrl() {
    return (process.env.TERMII_BASE_URL || "https://api.ng.termii.com").trim().replace(/\/+$/, "");
}

// One place that talks to Termii. Throws a readable error if Termii says no.
async function termiiPost(path, payload) {
    const response = await fetch(baseUrl() + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    let body = null;
    try { body = await response.json(); } catch (e) { /* ignore */ }

    const refused = !response.ok || (body && body.code && String(body.code).toLowerCase() !== "ok");
    if (refused) {
        throw new Error("Termii error " + response.status + " " + JSON.stringify(body));
    }

    return body;
}

async function sendWithTermii(to, text) {
    return termiiPost("/api/sms/send", {
        to: to.replace(/^\+/, ""),               // Termii wants digits only
        from: process.env.TERMII_SENDER_ID || "CashBook",
        sms: text,
        type: "plain",
        channel: process.env.TERMII_CHANNEL || "generic",
        api_key: process.env.TERMII_API_KEY
    });
}

async function sendSms(to, text) {
    try {
        if (process.env.TERMII_API_KEY) {
            await sendWithTermii(to, text);
            return { mode: "termii" };
        }

        printMessage(to, text);
        return { mode: "dev" };
    } catch (error) {
        printMessage(to, text);
        throw error;
    }
}

// ---- WhatsApp (approved Authentication template) --------------------------
function whatsappConfigured() {
    return Boolean(
        process.env.TERMII_API_KEY &&
        process.env.TERMII_WHATSAPP_DEVICE_ID &&
        process.env.TERMII_WHATSAPP_TEMPLATE_ID
    );
}

// Authentication templates take only the code in "data" (Termii's rule for OTP templates)
async function sendWhatsAppOtp(to, code) {
    if (!whatsappConfigured()) {
        throw new Error("WhatsApp is not configured (TERMII_WHATSAPP_DEVICE_ID / TERMII_WHATSAPP_TEMPLATE_ID).");
    }

    return termiiPost("/api/send/template", {
        phone_number: to.replace(/^\+/, ""),
        device_id: process.env.TERMII_WHATSAPP_DEVICE_ID,
        template_id: process.env.TERMII_WHATSAPP_TEMPLATE_ID,
        api_key: process.env.TERMII_API_KEY,
        data: { otp: String(code) }
    });
}

module.exports = sendSms;
module.exports.sendWhatsAppOtp = sendWhatsAppOtp;
module.exports.whatsappConfigured = whatsappConfigured;
