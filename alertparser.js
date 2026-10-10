// alertparser.js
// Reads the text of a Nigerian bank debit/credit alert (SMS or email) and returns
// { type, amount, description, date, time, category } so CashBook can pre-fill a transaction.
//
// It runs entirely in the browser: the pasted text is never sent anywhere. The user always
// reviews and saves the transaction themselves, so a wrong guess is easy to correct.
//
// Works with the usual layouts from GTBank, Access, Zenith, UBA, First Bank, Opay, Kuda,
// Moniepoint and similar ("Amt:NGN5,000.00 DR Desc:...", "You sent N5,000 to ...").

(function (root) {
    "use strict";

    var MONTHS = {
        jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
        jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
    };

    // Words that mean money went OUT or came IN. Checked in the order they appear.
    var OUT_WORDS = /\b(debit(?:ed)?|dr|withdrawal|withdrawn|purchase|you sent|sent to|paid|payment to|transfer to|trf to|pos\s+(?:debit|purchase)|airtime|bill payment)\b/gi;
    var IN_WORDS = /\b(credit(?:ed)?|cr|you received|received from|deposit(?:ed)?|inflow|transfer from|trf from|salary)\b/gi;

    // Keywords that suggest a category. First match wins.
    var CATEGORY_RULES = [
        { category: "Airtime",       words: ["airtime", "recharge", "vtu"] },
        { category: "Data",          words: ["data bundle", "data plan", "mb data", "gb data", "data sub", "smile", "spectranet"] },
        { category: "Utilities",     words: ["electric", "nepa", "ikedc", "ekedc", "phcn", "prepaid", "dstv", "gotv", "startimes", "water", "utility", "cable", "ibedc", "aedc"] },
        { category: "Transport",     words: ["uber", "bolt", "indrive", "transport", "fuel", "petrol", "filling station", "bus", "ride", "lagbus", "brt"] },
        { category: "Food",          words: ["food", "restaurant", "chicken", "kfc", "shoprite", "market", "grocer", "supermarket", "bakery", "eatery", "cafe", "pizza", "chowdeck", "foodcourt", "mama put"] },
        { category: "Entertainment", words: ["netflix", "showmax", "spotify", "cinema", "game", "betting", "bet9ja", "sportybet", "club", "youtube"] },
        { category: "Salary",        words: ["salary", "payroll", "wages", "stipend", "allowance"] },
        { category: "Business",      words: ["invoice", "sales", "customer", "business", "pos settlement", "merchant"] }
    ];

    function pad(n) { return String(n).padStart(2, "0"); }

    function toInputDate(d) {
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    }

    function toInputTime(d) {
        return pad(d.getHours()) + ":" + pad(d.getMinutes());
    }

    function fullYear(y) {
        var n = Number(y);
        return n < 100 ? 2000 + n : n;
    }

    function validDate(y, m, d) {
        if (m < 1 || m > 12 || d < 1 || d > 31) return false;
        var test = new Date(y, m - 1, d);
        return test.getFullYear() === y && test.getMonth() === m - 1 && test.getDate() === d;
    }

    // Finds a date anywhere in the text. Returns "YYYY-MM-DD" or "".
    function findDate(text) {
        var m;

        // 2026-10-07
        m = /\b(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/.exec(text);
        if (m && validDate(+m[1], +m[2], +m[3])) return m[1] + "-" + pad(m[2]) + "-" + pad(m[3]);

        // 07-Oct-2026, 07 Oct 26, 7/Oct/2026, 07-OCT-26
        m = /\b(\d{1,2})[\s\-\/.]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-\/.,]*(\d{2,4})\b/i.exec(text);
        if (m) {
            var y1 = fullYear(m[3]);
            var mo1 = MONTHS[m[2].toLowerCase()];
            if (validDate(y1, mo1, +m[1])) return y1 + "-" + pad(mo1) + "-" + pad(m[1]);
        }

        // Oct 7, 2026
        m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})\b/i.exec(text);
        if (m) {
            var y2 = fullYear(m[3]);
            var mo2 = MONTHS[m[1].toLowerCase()];
            if (validDate(y2, mo2, +m[2])) return y2 + "-" + pad(mo2) + "-" + pad(m[2]);
        }

        // 07/10/2026 or 07-10-26 (Nigerian banks write day first)
        m = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/.exec(text);
        if (m) {
            var y3 = fullYear(m[3]);
            if (validDate(y3, +m[2], +m[1])) return y3 + "-" + pad(m[2]) + "-" + pad(m[1]);
        }

        return "";
    }

    // Finds a time such as 14:05 or 14:05:33 or 2:05 PM. Returns "HH:MM" or "".
    function findTime(text) {
        var m = /\b(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?\b/i.exec(text);
        if (!m) return "";
        var h = +m[1];
        var min = +m[2];
        if (m[3]) {
            var pm = m[3].toLowerCase() === "pm";
            if (pm && h < 12) h += 12;
            if (!pm && h === 12) h = 0;
        }
        if (h > 23 || min > 59) return "";
        return pad(h) + ":" + pad(min);
    }

    // Picks the transaction amount, skipping any figure that is a balance.
    function findAmount(text) {
        var re = /(?:ngn|naira|n|₦)\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)(?![0-9])/gi;
        var candidates = [];
        var m;
        while ((m = re.exec(text)) !== null) {
            // "N" must not be the tail end of a word (e.g. "RUN 5") - check the char before
            var before = text.charAt(m.index - 1);
            if (/[a-z]/i.test(before) && !/^(ngn|naira)/i.test(m[0])) continue;

            var value = parseFloat(m[1].replace(/,/g, ""));
            if (!isFinite(value) || value <= 0) continue;

            // Look at the ~28 characters before the figure for a balance label.
            var lead = text.slice(Math.max(0, m.index - 28), m.index).toLowerCase();
            var isBalance = /(bal|balance|avail|available|ledger)\s*[:\-]?\s*$/.test(lead) ||
                            /(avail(?:able)?\s*bal(?:ance)?|bal(?:ance)?)\s*[:\-=]*\s*$/.test(lead);
            if (isBalance) continue;

            candidates.push({ value: value, index: m.index });
        }
        return candidates.length ? candidates[0].value : 0;
    }

    // Decides money in or out by whichever signal word appears first.
    function findType(text) {
        OUT_WORDS.lastIndex = 0;
        IN_WORDS.lastIndex = 0;
        var out = OUT_WORDS.exec(text);
        var inn = IN_WORDS.exec(text);

        if (out && !inn) return "expense";
        if (inn && !out) return "income";
        if (out && inn) return out.index < inn.index ? "expense" : "income";
        return "";
    }

    // Text after a label such as Desc:, Narration:, Remark:, up to the next field label.
    function labelled(text) {
        var re = /(?:desc(?:ription)?|narration|narr|remark|details?|ref(?:erence)?\s*note|purpose)\s*[:\-]\s*(.+?)(?=\s+(?:avail|bal|balance|date|time|ref|acct|account|amt|amount|txn|value|dt|tran|trx|session)\b\s*[:\-]|\s+(?:avail|bal)\b|$)/i;
        var m = re.exec(text.replace(/\s+/g, " "));
        return m ? m[1].trim() : "";
    }

    function cleanDescription(text) {
        var d = String(text || "")
            .replace(/\b(?:avail(?:able)?\s*bal(?:ance)?|bal(?:ance)?)\b.*$/i, "")
            .replace(/[\s:;,\-\/.]+$/g, "")
            .replace(/\s+/g, " ")
            .trim();
        if (d.length > 70) d = d.slice(0, 67).trim() + "...";
        return d;
    }

    // "You sent N5,000 to JOHN DOE" / "received N5,000 from JANE"
    function partyDescription(text) {
        var flat = text.replace(/\s+/g, " ");
        var m = /\b(?:sent|paid|transfer(?:red)?)\b.{0,40}?\bto\s+([A-Za-z0-9][A-Za-z0-9 .&'\-\/]{2,50}?)(?=\s*(?:\.|,|\bon\b|\bat\b|\bref\b|\bavail|\bbal|\bdate|\bsuccess|$))/i.exec(flat);
        if (m) return "Transfer to " + m[1].trim();
        m = /\breceived\b.{0,40}?\bfrom\s+([A-Za-z0-9][A-Za-z0-9 .&'\-\/]{2,50}?)(?=\s*(?:\.|,|\bon\b|\bat\b|\bref\b|\bavail|\bbal|\bdate|\bsuccess|$))/i.exec(flat);
        if (m) return "Transfer from " + m[1].trim();
        return "";
    }

    function guessCategory(text, type) {
        var low = text.toLowerCase();
        for (var i = 0; i < CATEGORY_RULES.length; i++) {
            var rule = CATEGORY_RULES[i];
            // Income-only categories should not be applied to money going out, and vice versa.
            if (type === "expense" && (rule.category === "Salary")) continue;
            if (type === "income" && (rule.category === "Airtime" || rule.category === "Data" || rule.category === "Utilities" ||
                rule.category === "Transport" || rule.category === "Food" || rule.category === "Entertainment")) continue;
            for (var j = 0; j < rule.words.length; j++) {
                if (low.indexOf(rule.words[j]) !== -1) return rule.category;
            }
        }
        return "Other";
    }

    function parse(rawText, nowDate) {
        var now = nowDate || new Date();
        var text = String(rawText || "").replace(/\r/g, "\n").trim();

        var empty = { ok: false, type: "", amount: 0, description: "", date: toInputDate(now), time: toInputTime(now), category: "Other", confidence: "none" };
        if (!text) return empty;

        var amount = findAmount(text);
        var type = findType(text);
        var date = findDate(text);
        var time = findTime(text);

        var description = cleanDescription(labelled(text)) || cleanDescription(partyDescription(text));
        if (!description) {
            description = type === "income" ? "Bank credit" : type === "expense" ? "Bank debit" : "Bank alert";
        }

        var category = guessCategory(text, type || "expense");

        var found = (amount > 0 ? 1 : 0) + (type ? 1 : 0) + (date ? 1 : 0);
        var confidence = found === 3 ? "high" : found === 2 && amount > 0 ? "medium" : amount > 0 ? "low" : "none";

        return {
            ok: amount > 0,
            type: type,
            amount: amount,
            description: description,
            date: date || toInputDate(now),
            time: time || toInputTime(now),
            category: category,
            confidence: confidence,
            dateFound: !!date
        };
    }

    var api = { parse: parse };

    if (typeof module !== "undefined" && module.exports) module.exports = api;
    root.AlertParser = api;
})(typeof window !== "undefined" ? window : this);
