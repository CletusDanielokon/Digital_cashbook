// Turns a list of transactions into the numbers a report needs.
// Money is added up in kobo (whole numbers) so 0.1 + 0.2 never drifts.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// "2026-10-06" -> true only for a real calendar date
function isRealDate(text) {
    if (!DATE_PATTERN.test(text)) return false;
    const d = new Date(text + "T00:00:00Z");
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-10-06" -> "6 Oct 2026"
function prettyDate(text) {
    if (!isRealDate(text)) return String(text || "");
    const [y, m, d] = text.split("-");
    return Number(d) + " " + MONTHS[Number(m) - 1] + " " + y;
}

function periodLabel(from, to) {
    if (from && to) return prettyDate(from) + " to " + prettyDate(to);
    if (from) return "From " + prettyDate(from);
    if (to) return "Up to " + prettyDate(to);
    return "All time";
}

const toKobo = (n) => Math.round((Number(n) || 0) * 100);

function build(transactions, from, to) {
    let income = 0;
    let expenses = 0;
    const byCategory = {};

    const rows = transactions.map((t) => {
        const kobo = toKobo(t.amount);
        const type = String(t.type || "").toLowerCase() === "income" ? "income" : "expense";

        if (type === "income") income += kobo;
        else {
            expenses += kobo;
            const name = t.category || "Other";
            byCategory[name] = (byCategory[name] || 0) + kobo;
        }

        return {
            date: t.date || "",
            time: t.time || "",
            description: t.description || "",
            category: t.category || "Other",
            type,
            amount: kobo / 100
        };
    });

    const categories = Object.keys(byCategory)
        .map((name) => ({
            category: name,
            amount: byCategory[name] / 100,
            percent: expenses > 0 ? (byCategory[name] / expenses) * 100 : 0
        }))
        .sort((a, b) => b.amount - a.amount);

    return {
        period: periodLabel(from, to),
        count: rows.length,
        income: income / 100,
        expenses: expenses / 100,
        balance: (income - expenses) / 100,
        categories,
        rows
    };
}

module.exports = { build, isRealDate, prettyDate, periodLabel };
