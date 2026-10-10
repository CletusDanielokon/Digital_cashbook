const ExcelJS = require("exceljs");
const { prettyDate } = require("./reportData");

const GREEN = "FF16A34A";
const NAVY = "FF0F172A";
const MONEY = '"₦"#,##0.00';

// Builds an .xlsx file (as a Buffer) with two sheets: Summary and Transactions.
async function buildXlsx({ user, report }) {
    const wb = new ExcelJS.Workbook();
    wb.creator = "CashBook";
    wb.created = new Date();

    // Summary is the first tab; it is filled in below, after the Transactions sheet exists
    const sm = wb.addWorksheet("Summary", { views: [{ showGridLines: false }] });

    // ---------------- Transactions sheet ----------------
    const tx = wb.addWorksheet("Transactions", { views: [{ state: "frozen", ySplit: 1 }] });

    tx.columns = [
        { header: "Date", key: "date", width: 14 },
        { header: "Time", key: "time", width: 9 },
        { header: "Description", key: "description", width: 38 },
        { header: "Category", key: "category", width: 18 },
        { header: "Type", key: "type", width: 10 },
        { header: "Income", key: "income", width: 16, style: { numFmt: MONEY } },
        { header: "Expense", key: "expense", width: 16, style: { numFmt: MONEY } }
    ];

    const head = tx.getRow(1);
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    head.alignment = { vertical: "middle" };
    head.height = 22;

    report.rows.forEach((r) => {
        tx.addRow({
            date: r.date,
            time: r.time,
            description: r.description,
            category: r.category,
            type: r.type === "income" ? "Income" : "Expense",
            income: r.type === "income" ? r.amount : null,
            expense: r.type === "expense" ? r.amount : null
        });
    });

    const last = report.rows.length + 1;
    const totalRow = tx.addRow({ description: "TOTAL" });
    totalRow.getCell("income").value = { formula: report.rows.length ? `SUM(F2:F${last})` : "0", result: report.income };
    totalRow.getCell("expense").value = { formula: report.rows.length ? `SUM(G2:G${last})` : "0", result: report.expenses };
    totalRow.font = { bold: true };
    totalRow.border = { top: { style: "thin" } };
    totalRow.getCell("income").numFmt = MONEY;
    totalRow.getCell("expense").numFmt = MONEY;

    if (report.rows.length) {
        tx.autoFilter = { from: "A1", to: "G" + last };
    }

    // ---------------- Summary sheet ----------------
    wb.views = [{ activeTab: 0 }];
    sm.columns = [{ width: 28 }, { width: 20 }, { width: 14 }];

    sm.mergeCells("A1:C1");
    sm.getCell("A1").value = "CashBook Financial Report";
    sm.getCell("A1").font = { size: 18, bold: true, color: { argb: GREEN } };
    sm.getRow(1).height = 28;

    const info = [
        ["Name", user.fullName || ""],
        ["CashBook", user.book || ""],
        ["Period", report.period],
        ["Generated", prettyDate(new Date().toISOString().slice(0, 10))]
    ];
    info.forEach(([k, v], i) => {
        sm.getCell("A" + (3 + i)).value = k;
        sm.getCell("A" + (3 + i)).font = { bold: true };
        sm.getCell("B" + (3 + i)).value = v;
        sm.getCell("B" + (3 + i)).alignment = { horizontal: "left" };
    });

    // Totals: the balance is a live formula
    sm.getCell("A8").value = "Total income";
    sm.getCell("B8").value = { formula: "Transactions!F" + (last + 1), result: report.income };
    sm.getCell("A9").value = "Total expenses";
    sm.getCell("B9").value = { formula: "Transactions!G" + (last + 1), result: report.expenses };
    sm.getCell("A10").value = "Balance";
    sm.getCell("B10").value = { formula: "B8-B9", result: report.balance };
    sm.getCell("A11").value = "Number of transactions";
    sm.getCell("B11").value = report.count;
    ["B8", "B9", "B10"].forEach((c) => { sm.getCell(c).numFmt = MONEY; });
    ["A8", "A9", "A10", "A11"].forEach((c) => { sm.getCell(c).font = { bold: true }; });
    sm.getCell("A10").font = { bold: true, size: 12 };
    sm.getCell("B10").font = { bold: true, size: 12, color: { argb: report.balance < 0 ? "FFDC2626" : GREEN } };
    sm.getRow(10).border = { top: { style: "thin" } };

    // Spending by category
    sm.getCell("A13").value = "Spending by category";
    sm.getCell("A13").font = { bold: true, size: 13 };
    ["Category", "Amount", "Share"].forEach((h, i) => {
        const c = sm.getCell(14, i + 1);
        c.value = h;
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
        if (i > 0) c.alignment = { horizontal: "right" };
    });

    if (report.categories.length === 0) {
        sm.getCell("A15").value = "No expenses in this period.";
    } else {
        report.categories.forEach((c, i) => {
            const row = 15 + i;
            sm.getCell(row, 1).value = c.category;
            sm.getCell(row, 2).value = c.amount;
            sm.getCell(row, 2).numFmt = MONEY;
            sm.getCell(row, 3).value = c.percent / 100;
            sm.getCell(row, 3).numFmt = "0.0%";
        });
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = buildXlsx;
