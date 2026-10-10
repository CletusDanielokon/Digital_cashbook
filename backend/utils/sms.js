// Sends a text message. Provider is chosen from .env:
//
//   TERMII_API_KEY set  -> sends with Termii (https://termii.com), a Nigerian SMS provider.
//                          TERMII_SENDER_ID  sender name (must be registered with Termii)
//                          TERMII_CHANNEL    "generic" (default) or "dnd" (reaches numbers on Do-Not-Disturb)
//   not set             -> prints the message in the terminal / server log (development)
//
// The phone number must already be in the standard "+234..." format.

function printMessage(to, text) {
    console.log("\n[DEV MODE - SMS not configured] Message that would be sent:");
    console.log("To:   " + to);
    console.log(text + "\n");
}

async function sendWithTermii(to, text) {
    const response = await fetch("https://api.ng.termii.com/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            to: to.replace(/^\+/, ""),               // Termii wants digits only
            from: process.env.TERMII_SENDER_ID || "CashBook",
            sms: text,
            type: "plain",
            channel: process.env.TERMII_CHANNEL || "generic",
            api_key: process.env.TERMII_API_KEY
        })
    });

    let body = null;
    try { body = await response.json(); } catch (e) { /* ignore */ }

    if (!response.ok) {
        throw new Error("Termii error " + response.status + " " + JSON.stringify(body));
    }
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

module.exports = sendSms;
