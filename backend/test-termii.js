// Sends ONE test message so you can check your Termii setup.
//
//   node test-termii.js sms      +2348012345678
//   node test-termii.js whatsapp +2348012345678
//
// It reads the same .env file as the server and never prints your API key.
require("dotenv").config();
const sendSms = require("./utils/sms");

const [kind, phone] = process.argv.slice(2);

if (!["sms", "whatsapp"].includes(kind) || !/^\+[0-9]{10,15}$/.test(phone || "")) {
    console.log('\nUsage:  node test-termii.js sms +2348012345678\n        node test-termii.js whatsapp +2348012345678\n');
    process.exit(1);
}

if (!process.env.TERMII_API_KEY) {
    console.log("\nTERMII_API_KEY is not set in backend/.env yet. Add it and run this again.\n");
    process.exit(1);
}

console.log("Base URL  :", process.env.TERMII_BASE_URL || "https://api.ng.termii.com (default)");
console.log("Sender ID :", process.env.TERMII_SENDER_ID || "CashBook (default)");
console.log("Channel   :", process.env.TERMII_CHANNEL || "generic (default)");

(async () => {
    try {
        if (kind === "sms") {
            const result = await sendSms(phone, "CashBook test message. If you can read this, SMS is working.");
            console.log("\nResult:", result.mode === "termii" ? "Termii accepted the SMS. Check the phone." : "Not sent (no API key).");
        } else {
            const reply = await sendSms.sendWhatsAppOtp(phone, "123456");
            console.log("\nTermii accepted the WhatsApp message. Check WhatsApp. Reply:", JSON.stringify(reply));
        }
    } catch (error) {
        console.log("\nFAILED:", error.message, "\n");
        process.exit(1);
    }
})();
