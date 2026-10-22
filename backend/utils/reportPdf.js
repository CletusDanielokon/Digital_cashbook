const path = require("path");
const PDFDocument = require("pdfkit");
const { prettyDate } = require("./reportData");

const FONT = path.join(__dirname, "..", "assets", "fonts", "DejaVuSans.ttf");
const FONT_BOLD = path.join(__dirname, "..", "assets", "fonts", "DejaVuSans-Bold.ttf");

const GREEN = "#16a34a";
const NAVY = "#0f172a";
const GREY = "#64748b";
const LIGHT = "#f1f5f9";
const RED = "#dc2626";

const naira = (n) =>
    (n < 0 ? "-" : "") + "₦" +
    new Intl.NumberFormat("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));

// Cut text so it fits in `maxWidth` points (PDFKit's own ellipsis option does not stop wrapping)
function fit(doc, text, maxWidth) {
    let t = String(text || "").replace(/\s+/g, " ");
    if (doc.widthOfString(t) <= maxWidth) return t;
    while (t.length > 1 && doc.widthOfString(t + "…") > maxWidth) t = t.slice(0, -1);
    return t.trimEnd() + "…";
}

// Writes the PDF into `stream` (an HTTP response, or any writable stream).
// Resolves when the document has been fully written.
function writePdf({ user, report }, stream) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true, info: { Title: "CashBook Report", Author: "CashBook" } });
        doc.registerFont("body", FONT);
        doc.registerFont("bold", FONT_BOLD);

        doc.on("error", reject);
        stream.on("error", reject);
        stream.on("finish", resolve);
        doc.pipe(stream);

        const left = 40;
        const width = doc.page.width - 80;
        const bottomLimit = doc.page.height - 60;

        // ---------- header ----------
        doc.rect(0, 0, doc.page.width, 8).fill(GREEN);
        doc.fillColor(NAVY).font("bold").fontSize(22).text("CashBook", left, 30);
        doc.fillColor(GREY).font("body").fontSize(11).text("Financial report", left, 56);

        doc.fillColor(GREY).font("body").fontSize(9)
            .text("Generated " + prettyDate(new Date().toISOString().slice(0, 10)), left, 34, { width, align: "right" });

        doc.fillColor(NAVY).font("bold").fontSize(11);
        doc.text(fit(doc, user.fullName, width / 2 - 10), left, 84, { width: width / 2, lineBreak: false });
        doc.fillColor(GREY).font("body").fontSize(10);
        doc.text(fit(doc, user.book, width / 2 - 10), left, 100, { width: width / 2, lineBreak: false });

        doc.fillColor(NAVY).font("bold").fontSize(11).text("Period", left + width / 2, 84, { width: width / 2, align: "right" });
        doc.fillColor(GREY).font("body").fontSize(10).text(report.period, left + width / 2, 100, { width: width / 2, align: "right" });

        // ---------- summary cards ----------
        const cardY = 128;
        const gap = 12;
        const cardW = (width - gap * 2) / 3;
        const cards = [
            ["Income", naira(report.income), GREEN],
            ["Expenses", naira(report.expenses), NAVY],
            ["Balance", naira(report.balance), report.balance < 0 ? RED : GREEN]
        ];

        cards.forEach(([label, value, color], i) => {
            const x = left + i * (cardW + gap);
            doc.roundedRect(x, cardY, cardW, 58, 6).fill(LIGHT);
            doc.fillColor(GREY).font("body").fontSize(9).text(label, x + 12, cardY + 10, { width: cardW - 24 });
            doc.fillColor(color).font("bold").fontSize(14).text(value, x + 12, cardY + 28, { width: cardW - 24, lineBreak: false });
        });

        doc.fillColor(GREY).font("body").fontSize(9)
            .text(report.count + (report.count === 1 ? " transaction" : " transactions"), left, cardY + 66);

        let y = cardY + 90;

        function ensureSpace(needed) {
            if (y + needed > bottomLimit) {
                doc.addPage();
                y = 40;
                return true;
            }
            return false;
        }

        // ---------- spending by category ----------
        doc.fillColor(NAVY).font("bold").fontSize(13).text("Spending by category", left, y);
        y += 24;

        if (report.categories.length === 0) {
            doc.fillColor(GREY).font("body").fontSize(10).text("No expenses in this period.", left, y);
            y += 24;
        } else {
            report.categories.forEach((c) => {
                ensureSpace(30);
                doc.fillColor(NAVY).font("body").fontSize(10);
                doc.text(fit(doc, c.category, 200), left, y, { width: 210, lineBreak: false });
                doc.fillColor(NAVY).font("bold").fontSize(10).text(naira(c.amount), left + width - 200, y, { width: 150, align: "right", lineBreak: false });
                doc.fillColor(GREY).font("body").fontSize(9).text(c.percent.toFixed(1) + "%", left + width - 45, y + 1, { width: 45, align: "right", lineBreak: false });
                doc.roundedRect(left, y + 15, width, 5, 2).fill("#e2e8f0");
                doc.roundedRect(left, y + 15, Math.max(2, (width * c.percent) / 100), 5, 2).fill(GREEN);
                y += 30;
            });
        }

        // ---------- transactions table ----------
        y += 8;
        ensureSpace(80);
        doc.fillColor(NAVY).font("bold").fontSize(13).text("Transactions", left, y);
        y += 24;

        const cols = [
            { key: "date", title: "Date", x: left, w: 66 },
            { key: "description", title: "Description", x: left + 66, w: 190 },
            { key: "category", title: "Category", x: left + 256, w: 95 },
            { key: "type", title: "Type", x: left + 351, w: 55 },
            { key: "amount", title: "Amount", x: left + 406, w: width - 406, align: "right" }
        ];

        function tableHeader() {
            doc.rect(left, y, width, 20).fill(NAVY);
            cols.forEach((c) => {
                doc.fillColor("#ffffff").font("bold").fontSize(9)
                    .text(c.title, c.x + 5, y + 6, { width: c.w - 10, align: c.align || "left", lineBreak: false });
            });
            y += 20;
        }

        if (report.rows.length === 0) {
            doc.fillColor(GREY).font("body").fontSize(10).text("No transactions in this period.", left, y);
        } else {
            tableHeader();

            report.rows.forEach((r, i) => {
                if (ensureSpace(22)) tableHeader();

                if (i % 2 === 1) doc.rect(left, y, width, 20).fill("#f8fafc");

                const isIncome = r.type === "income";
                const cells = {
                    date: prettyDate(r.date),
                    description: r.description,
                    category: r.category,
                    type: isIncome ? "Income" : "Expense",
                    amount: (isIncome ? "+" : "-") + naira(r.amount)
                };

                cols.forEach((c) => {
                    const color = c.key === "amount" ? (isIncome ? GREEN : NAVY) : NAVY;
                    doc.fillColor(color).font(c.key === "amount" ? "bold" : "body").fontSize(9);
                    doc.text(fit(doc, cells[c.key], c.w - 10), c.x + 5, y + 6, { width: c.w - 10, align: c.align || "left", lineBreak: false });
                });

                y += 20;
            });

            // totals line
            ensureSpace(30);
            doc.moveTo(left, y + 2).lineTo(left + width, y + 2).strokeColor(NAVY).lineWidth(1).stroke();
            doc.fillColor(NAVY).font("bold").fontSize(10)
                .text("Balance for this period", left + 5, y + 10, { width: 250, lineBreak: false })
                .text(naira(report.balance), left + 256, y + 10, { width: width - 261, align: "right", lineBreak: false });
        }

        // ---------- debts ----------
        const debts = report.debts;

        if (debts) {
            y += report.rows.length === 0 ? 30 : 44;
            ensureSpace(120);
            doc.fillColor(NAVY).font("bold").fontSize(13).text("Debts", left, y);
            doc.fillColor(GREY).font("body").fontSize(9)
                .text("As of " + prettyDate(debts.asOf) + " (not limited to the dates above)", left, y + 3, { width, align: "right" });
            y += 24;

            const dCards = [
                ["Owed to you (unpaid)", naira(debts.owedToMe.outstanding), GREEN],
                ["You owe (unpaid)", naira(debts.iOwe.outstanding), debts.iOwe.outstanding > 0 ? RED : NAVY],
                ["Overdue debts", String(debts.overdueCount), debts.overdueCount > 0 ? RED : NAVY]
            ];
            dCards.forEach(([label, value, color], i) => {
                const x = left + i * (cardW + gap);
                doc.roundedRect(x, y, cardW, 50, 6).fill(LIGHT);
                doc.fillColor(GREY).font("body").fontSize(9).text(label, x + 12, y + 9, { width: cardW - 24 });
                doc.fillColor(color).font("bold").fontSize(13).text(value, x + 12, y + 25, { width: cardW - 24, lineBreak: false });
            });
            y += 66;

            const dCols = [
                { key: "person", title: "Person", x: left, w: 96 },
                { key: "category", title: "For", x: left + 96, w: 64 },
                { key: "dueDate", title: "Due", x: left + 160, w: 72 },
                { key: "amount", title: "Amount", x: left + 232, w: 75, align: "right" },
                { key: "paid", title: "Paid", x: left + 307, w: 75, align: "right" },
                { key: "remaining", title: "Left", x: left + 382, w: 75, align: "right" },
                { key: "status", title: "Status", x: left + 457, w: width - 457 }
            ];

            function debtHeader() {
                doc.rect(left, y, width, 20).fill(NAVY);
                dCols.forEach((c) => {
                    doc.fillColor("#ffffff").font("bold").fontSize(9)
                        .text(c.title, c.x + 5, y + 6, { width: c.w - 10, align: c.align || "left", lineBreak: false });
                });
                y += 20;
            }

            [["owed_to_me", "Owed to you"], ["i_owe", "You owe"]].forEach(([direction, title]) => {
                const group = debts.rows.filter((r) => r.direction === direction);

                ensureSpace(70);
                doc.fillColor(NAVY).font("bold").fontSize(11).text(title, left, y);
                y += 18;

                if (group.length === 0) {
                    doc.fillColor(GREY).font("body").fontSize(10).text("Nothing recorded.", left, y);
                    y += 26;
                    return;
                }

                debtHeader();

                group.forEach((r, i) => {
                    if (ensureSpace(22)) debtHeader();
                    if (i % 2 === 1) doc.rect(left, y, width, 20).fill("#f8fafc");

                    const cells = {
                        person: r.person,
                        category: r.category,
                        dueDate: r.dueDate ? prettyDate(r.dueDate) : "-",
                        amount: naira(r.amount),
                        paid: naira(r.paid),
                        remaining: naira(r.remaining),
                        status: r.status
                    };

                    dCols.forEach((c) => {
                        let color = NAVY;
                        if (c.key === "status") color = r.status === "Overdue" ? RED : r.status === "Paid" ? GREEN : NAVY;
                        doc.fillColor(color).font(c.key === "status" || c.key === "remaining" ? "bold" : "body").fontSize(9);
                        doc.text(fit(doc, cells[c.key], c.w - 10), c.x + 5, y + 6, { width: c.w - 10, align: c.align || "left", lineBreak: false });
                    });

                    y += 20;
                });

                y += 16;
            });
        }

        // ---------- footer on every page ----------
        const range = doc.bufferedPageRange();

        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            // The footer sits inside the bottom margin; without this PDFKit would add a blank page for it
            doc.page.margins.bottom = 0;
            doc.fillColor(GREY).font("body").fontSize(8)
                .text("CashBook  |  Page " + (i + 1) + " of " + range.count, left, doc.page.height - 36, { width, align: "center", lineBreak: false });
        }

        doc.end();
    });
}

module.exports = writePdf;
