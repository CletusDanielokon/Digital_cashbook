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

const CATEGORY_NAMES = {
    loan: "Loan", service: "Service", goods: "Goods",
    bill: "Bill", rent: "Rent", other: "Other"
};

// Today's date in Nigerian time (YYYY-MM-DD), so "overdue" does not flip at the wrong hour
function todayInLagos() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
}

// Turns the user's debts into the numbers and rows the report shows. It is a picture of
// where things stand today, not limited to the report's date range.
function buildDebts(debts) {
    const today = todayInLagos();

    const make = () => ({ count: 0, outstanding: 0, total: 0, paid: 0 });
    const owedToMe = make();
    const iOwe = make();
    let overdueCount = 0;

    const rows = (debts || []).map((d) => {
        const amount = toKobo(d.amount);
        const paid = (d.payments || []).reduce((sum, p) => sum + toKobo(p.amount), 0);
        const remaining = Math.max(0, amount - paid);
        const direction = d.direction === "i_owe" ? "i_owe" : "owed_to_me";

        let status = "Open";
        if (remaining <= 0) status = "Paid";
        else if (d.dueDate && d.dueDate < today) status = "Overdue";

        const group = direction === "i_owe" ? iOwe : owedToMe;
        group.total += amount;
        group.paid += Math.min(paid, amount);
        if (remaining > 0) {
            group.count += 1;
            group.outstanding += remaining;
        }
        if (status === "Overdue") overdueCount += 1;

        return {
            person: d.personName || "",
            direction,
            category: CATEGORY_NAMES[d.category] || "",
            date: d.dateLent || "",
            dueDate: d.dueDate || "",
            amount: amount / 100,
            paid: Math.min(paid, amount) / 100,
            remaining: remaining / 100,
            status,
            note: d.note || ""
        };
    });

    // Unpaid first (overdue before open), then paid; earliest due date first inside each group
    const rank = { Overdue: 0, Open: 1, Paid: 2 };
    rows.sort((a, b) => rank[a.status] - rank[b.status] || (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));

    const fin = (g) => ({ count: g.count, outstanding: g.outstanding / 100, total: g.total / 100, paid: g.paid / 100 });

    return { asOf: today, owedToMe: fin(owedToMe), iOwe: fin(iOwe), overdueCount, rows };
}

module.exports = { build, buildDebts, isRealDate, prettyDate, periodLabel };
