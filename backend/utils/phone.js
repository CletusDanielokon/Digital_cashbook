// Turns what a person types into one standard phone format, so the same
// number is never saved two ways (08012345678 and +2348012345678).
//
// Returns "+<country code><number>" or null if it does not look like a real number.
//   08012345678      -> +2348012345678   (Nigerian local format)
//   2348012345678    -> +2348012345678
//   +234 801 234 5678 -> +2348012345678
//   +44 7700 900123  -> +447700900123   (any international number with +)
function normalizePhone(input) {
    if (input === undefined || input === null) return null;

    let raw = String(input).trim();
    if (!raw) return null;

    // Only digits, spaces, dashes, dots, brackets and one leading + are allowed
    if (!/^\+?[0-9\s\-().]+$/.test(raw)) return null;

    const hasPlus = raw.startsWith("+");
    let digits = raw.replace(/\D/g, "");

    if (!hasPlus && digits.startsWith("00")) {
        digits = digits.slice(2);
        return /^[1-9][0-9]{7,14}$/.test(digits) ? "+" + digits : null;
    }

    if (hasPlus) {
        return /^[1-9][0-9]{7,14}$/.test(digits) ? "+" + digits : null;
    }

    // Nigerian numbers without a +
    if (/^0[789][01][0-9]{8}$/.test(digits)) return "+234" + digits.slice(1);
    if (/^234[789][01][0-9]{8}$/.test(digits)) return "+" + digits;
    if (/^[789][01][0-9]{8}$/.test(digits)) return "+234" + digits;

    return null;
}

// "+2348012345678" -> "+234 *** *** 5678"
function maskPhone(phone) {
    const p = String(phone || "");
    if (p.length < 8) return p;
    return p.slice(0, 4) + " ••• ••• " + p.slice(-4);
}

// "ada@example.com" -> "a**@example.com"
function maskEmail(email) {
    const [name, domain] = String(email || "").split("@");
    if (!domain) return String(email || "");
    return name.charAt(0) + "•".repeat(Math.max(2, Math.min(name.length - 1, 6))) + "@" + domain;
}

module.exports = { normalizePhone, maskPhone, maskEmail };
