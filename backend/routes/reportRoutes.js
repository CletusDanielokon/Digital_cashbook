const express = require("express");
const User = require("../models/user");
const Transaction = require("../models/Transaction");
const Debt = require("../models/Debt");
const protect = require("../middleware/authMiddleware");
const { build, buildDebts, isRealDate } = require("../utils/reportData");
const buildXlsx = require("../utils/reportXlsx");
const writePdf = require("../utils/reportPdf");

const router = express.Router();

router.use(protect);

// ===============================
// DOWNLOAD A REPORT
//   GET /api/reports/export?format=pdf|xlsx&from=2026-10-01&to=2026-10-31
// from and to are both optional (leave both out for "all time").
// ===============================
router.get("/export", async (req, res) => {
    try {
        const format = String(req.query.format || "").toLowerCase();
        const from = String(req.query.from || "").trim();
        const to = String(req.query.to || "").trim();

        if (format !== "pdf" && format !== "xlsx") {
            return res.status(400).json({ message: "Choose PDF or Excel." });
        }

        if ((from && !isRealDate(from)) || (to && !isRealDate(to))) {
            return res.status(400).json({ message: "Please choose valid dates." });
        }

        if (from && to && from > to) {
            return res.status(400).json({ message: "The start date must be on or before the end date." });
        }

        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(401).json({ message: "Account not found. Please log in again." });
        }

        // Only this user's transactions; dates are stored as YYYY-MM-DD text, so they sort and compare correctly
        const query = { user: req.userId };

        if (from || to) {
            query.date = {};
            if (from) query.date.$gte = from;
            if (to) query.date.$lte = to;
        }

        const transactions = await Transaction.find(query).sort({ date: 1, time: 1 });
        const report = build(transactions, from, to);
        report.debts = buildDebts(await Debt.find({ user: req.userId }).sort({ createdAt: 1 }));

        const stamp = (from || "start") + "_to_" + (to || "today");
        const baseName = "CashBook-report-" + stamp;

        if (format === "xlsx") {
            const buffer = await buildXlsx({ user, report });

            res.set({
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": 'attachment; filename="' + baseName + '.xlsx"',
                "Content-Length": buffer.length,
                "Cache-Control": "no-store"
            });
            return res.send(buffer);
        }

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": 'attachment; filename="' + baseName + '.pdf"',
            "Cache-Control": "no-store"
        });

        await writePdf({ user, report }, res);

    } catch (error) {
        console.error("Report export error:", error.message);

        if (!res.headersSent) {
            res.status(500).json({ message: "Server error while creating your report." });
        } else {
            res.end();
        }
    }
});

module.exports = router;
