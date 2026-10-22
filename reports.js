document.addEventListener("DOMContentLoaded", () => {

    // =================================
    // CHECK LOGIN
    // =================================

    const user = JSON.parse(
        localStorage.getItem("cashbookUser")
    );

    if (!user) {
        window.location.href = "index.html";
        return;
    }

    
    // =================================
    // USER PROFILE
    // =================================

    const userName =
        user.name ||
        user.fullName ||
        user.username ||
        "User";

    const profileInitial =
        userName.charAt(0).toUpperCase();


    document.getElementById("user-name").textContent =
        userName;

    document.getElementById("top-user-name").textContent =
        userName;

    document.getElementById("profile-initials").textContent =
        profileInitial;

    document.getElementById("top-profile-initials").textContent =
        profileInitial;
    


    // =================================
    // GET TRANSACTIONS
    // =================================

    let transactions = [];

    async function loadTransactions() {

        try {

            const token =
                localStorage.getItem("cashbookToken");

            const response =
                await fetch(
                    "http://localhost:5000/api/transactions",
                    {
                        method: "GET",
                        headers: {
                            "Authorization": `Bearer ${token}`
                        }
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                console.error(
                    data.message ||
                    "Unable to load transactions."
                );

                return;
            }

            transactions =
                data.transactions || [];

            generateReport();

        } catch (error) {

            console.error(
                "Error loading report transactions:",
                error
            );

        }
    }

    // =================================
    // ELEMENTS
    // =================================

    const startDate =
        document.getElementById("start-date");

    const endDate =
        document.getElementById("end-date");


    // =================================
    // FORMAT NAIRA
    // =================================

    function formatNaira(amount) {

        return new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
            minimumFractionDigits: 2
        }).format(amount);

    }


    // =================================
    // GET TRANSACTION DATE
    // =================================

    function getTransactionDate(transaction) {

        return (
            transaction.date ||
            transaction.transactionDate ||
            ""
        );

    }


    // =================================
    // GENERATE REPORT
    // =================================

    function generateReport() {

        const selectedStart =
            startDate.value;

        const selectedEnd =
            endDate.value;


        let filteredTransactions =
            [...transactions];


        // Filter by start date
        if (selectedStart) {

            filteredTransactions =
                filteredTransactions.filter(transaction => {

                    return getTransactionDate(transaction)
                        >= selectedStart;

                });

        }


        // Filter by end date
        if (selectedEnd) {

            filteredTransactions =
                filteredTransactions.filter(transaction => {

                    return getTransactionDate(transaction)
                        <= selectedEnd;

                });

        }


        // =================================
        // CALCULATE TOTALS
        // =================================

        let totalIncome = 0;
        let totalExpenses = 0;


        filteredTransactions.forEach(transaction => {

            const amount =
                Number(transaction.amount) || 0;

            const type =
                String(transaction.type || "")
                    .toLowerCase();


            if (type === "income") {

                totalIncome += amount;

            }


            if (type === "expense") {

                totalExpenses += amount;

            }

        });


        const balance =
            totalIncome - totalExpenses;


        // =================================
        // SUMMARY CARDS
        // =================================

        document.getElementById("total-income")
            .textContent =
            formatNaira(totalIncome);

        document.getElementById("total-expenses")
            .textContent =
            formatNaira(totalExpenses);

        document.getElementById("total-balance")
            .textContent =
            formatNaira(balance);


        // =================================
        // INCOME & EXPENSE REPORT
        // =================================

        document.getElementById("report-income")
            .textContent =
            formatNaira(totalIncome);

        document.getElementById("report-expenses")
            .textContent =
            formatNaira(totalExpenses);

        document.getElementById("report-balance")
            .textContent =
            formatNaira(balance);


        // =================================
        // SPENDING BY CATEGORY
        // =================================

        const categoryReport =
            document.getElementById("category-report");


        const categories = {};


        filteredTransactions.forEach(transaction => {

            const type =
                String(transaction.type || "")
                    .toLowerCase();


            if (type !== "expense") {
                return;
            }


            const category =
                transaction.category || "Other";


            const amount =
                Number(transaction.amount) || 0;


            if (!categories[category]) {
                categories[category] = 0;
            }


            categories[category] += amount;

        });


        categoryReport.innerHTML = "";


        const categoryNames =
            Object.keys(categories);


        if (categoryNames.length === 0) {

            categoryReport.innerHTML = `
                <p class="text-sm text-slate-500">
                    No expense data available.
                </p>
            `;

        } else {

            categoryNames
                .sort((a, b) =>
                    categories[b] - categories[a]
                )
                .forEach(category => {

                    const amount =
                        categories[category];


                    const percentage =
                        totalExpenses > 0
                            ? (amount / totalExpenses) * 100
                            : 0;


                    const item =
                        document.createElement("div");


                    item.innerHTML = `
                        <div class="flex items-center justify-between mb-1">

                            <span class="text-sm text-slate-600">
                                ${category}
                            </span>

                            <span class="text-sm font-semibold text-navy">
                                ${formatNaira(amount)}
                            </span>

                        </div>


                        <div class="w-full bg-slate-100 rounded-full h-2">

                            <div
                                class="bg-green h-2 rounded-full"
                                style="width: ${percentage}%"
                            ></div>

                        </div>


                        <p class="text-xs text-slate-400 mt-1">
                            ${percentage.toFixed(1)}%
                        </p>
                    `;


                    categoryReport.appendChild(item);

                });

        }


        // =================================
        // TRANSACTION SUMMARY
        // =================================

        const transactionSummary =
            document.getElementById(
                "transaction-summary"
            );


        transactionSummary.innerHTML = "";


        if (filteredTransactions.length === 0) {

            transactionSummary.innerHTML = `
                <p class="text-sm text-slate-500">
                    No transactions available.
                </p>
            `;

        } else {

            const incomeCount =
                filteredTransactions.filter(transaction =>
                    String(transaction.type || "")
                        .toLowerCase() === "income"
                ).length;


            const expenseCount =
                filteredTransactions.filter(transaction =>
                    String(transaction.type || "")
                        .toLowerCase() === "expense"
                ).length;


            transactionSummary.innerHTML = `

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">

                    <div class="bg-slate-50 rounded-xl p-4">

                        <p class="text-sm text-slate-500">
                            Total Transactions
                        </p>

                        <p class="text-2xl font-bold text-navy mt-1">
                            ${filteredTransactions.length}
                        </p>

                    </div>


                    <div class="bg-green/10 rounded-xl p-4">

                        <p class="text-sm text-slate-500">
                            Income Entries
                        </p>

                        <p class="text-2xl font-bold text-green mt-1">
                            ${incomeCount}
                        </p>

                    </div>


                    <div class="bg-slate-50 rounded-xl p-4">

                        <p class="text-sm text-slate-500">
                            Expense Entries
                        </p>

                        <p class="text-2xl font-bold text-navy mt-1">
                            ${expenseCount}
                        </p>

                    </div>

                </div>
            `;

        }

    }


    // =================================
    // DATE FILTER
    // =================================

    startDate.addEventListener(
        "change",
        generateReport
    );

    endDate.addEventListener(
        "change",
        generateReport
    );


    // =================================
    // QUICK PERIODS + DOWNLOAD (PDF / EXCEL)
    // =================================

    const exportStatus = document.getElementById("export-status");
    const exportPeriod = document.getElementById("export-period");
    const exportPdf = document.getElementById("export-pdf");
    const exportXlsx = document.getElementById("export-xlsx");
    const rangeChips = document.querySelectorAll("[data-range]");

    // Date as YYYY-MM-DD in the person's own time zone (toISOString would use UTC)
    function ymd(date) {
        return date.getFullYear() + "-" +
            String(date.getMonth() + 1).padStart(2, "0") + "-" +
            String(date.getDate()).padStart(2, "0");
    }

    function rangeFor(name) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        if (name === "this-month") return [ymd(new Date(year, month, 1)), ymd(now)];
        if (name === "last-month") return [ymd(new Date(year, month - 1, 1)), ymd(new Date(year, month, 0))];
        if (name === "last-3-months") return [ymd(new Date(year, month - 2, 1)), ymd(now)];
        if (name === "this-year") return [ymd(new Date(year, 0, 1)), ymd(now)];
        return ["", ""];   // all time
    }

    function prettyDay(text) {
        const [y, m, d] = text.split("-").map(Number);
        return new Date(y, m - 1, d).toLocaleDateString("en-NG", {
            day: "numeric", month: "short", year: "numeric"
        });
    }

    function updateExportLabel() {
        const from = startDate.value;
        const to = endDate.value;

        exportPeriod.textContent =
            from && to ? prettyDay(from) + " to " + prettyDay(to)
            : from ? "From " + prettyDay(from)
            : to ? "Up to " + prettyDay(to)
            : "All time";

        // Highlight the quick period that matches the dates, if any
        rangeChips.forEach(function (chip) {
            const [a, b] = rangeFor(chip.dataset.range);
            chip.classList.toggle("active", a === from && b === to);
        });
    }

    rangeChips.forEach(function (chip) {
        chip.addEventListener("click", function () {
            const [from, to] = rangeFor(chip.dataset.range);
            startDate.value = from;
            endDate.value = to;
            exportStatus.textContent = "";
            generateReport();
            updateExportLabel();
        });
    });

    startDate.addEventListener("change", updateExportLabel);
    endDate.addEventListener("change", updateExportLabel);

    function setExportStatus(text, isError) {
        exportStatus.textContent = text || "";
        exportStatus.className =
            "text-sm mt-3 font-semibold " + (isError ? "text-red-500" : "text-green");
    }

    async function downloadReport(format) {
        const from = startDate.value;
        const to = endDate.value;

        if (from && to && from > to) {
            setExportStatus("The start date must be on or before the end date.", true);
            return;
        }

        const params = new URLSearchParams({ format: format });
        if (from) params.set("from", from);
        if (to) params.set("to", to);

        exportPdf.disabled = true;
        exportXlsx.disabled = true;
        setExportStatus("Preparing your " + (format === "pdf" ? "PDF" : "Excel") + " file...", false);

        try {
            const response = await fetch(
                "http://localhost:5000/api/reports/export?" + params.toString(),
                { headers: { "Authorization": "Bearer " + localStorage.getItem("cashbookToken") } }
            );

            if (response.status === 401) {
                localStorage.removeItem("cashbookToken");
                localStorage.removeItem("cashbookUser");
                window.location.href = "index.html";
                return;
            }

            if (!response.ok) {
                let message = "Could not create the report.";
                try { message = (await response.json()).message || message; } catch (e) { /* not JSON */ }
                setExportStatus(message, true);
                return;
            }

            const blob = await response.blob();

            // Use the file name the server chose
            const disposition = response.headers.get("Content-Disposition") || "";
            const match = /filename="([^"]+)"/.exec(disposition);
            const fileName = match ? match[1] : "CashBook-report." + format;

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

            setExportStatus("Downloaded " + fileName, false);

        } catch (error) {
            console.error("Report download error:", error);
            setExportStatus("Unable to connect to the server.", true);
        } finally {
            exportPdf.disabled = false;
            exportXlsx.disabled = false;
        }
    }

    exportPdf.addEventListener("click", function () { downloadReport("pdf"); });
    exportXlsx.addEventListener("click", function () { downloadReport("xlsx"); });

    updateExportLabel();


    // =================================
    // NAVIGATION
    // =================================

    document
        .getElementById("dashboard-link")
        .addEventListener("click", () => {
            window.location.href = "dashboard.html";
        });


    document
        .getElementById("transactions-link")
        .addEventListener("click", () => {
            window.location.href = "transactions.html";
        });


    document
        .getElementById("budget-link")
        .addEventListener("click", () => {
            window.location.href = "budget.html";
        });


    document
        .getElementById("debts-link")
        .addEventListener("click", () => {
            window.location.href = "debts.html";
        });


    document
        .getElementById("reports-link")
        .addEventListener("click", () => {
            window.location.href = "reports.html";
        });


    document
        .getElementById("profile-link")
        .addEventListener("click", () => {
            window.location.href = "profile.html";
        });


    document
        .getElementById("settings-link")
        .addEventListener("click", () => {
            window.location.href = "settings.html";
        });


    // =================================
    // LOGOUT
    // =================================

    document
        .getElementById("logout-link")
        .addEventListener("click", () => {

            localStorage.removeItem("cashbookUser");
            localStorage.removeItem("cashbookToken");
            window.location.href = "index.html";

        });


    // =================================
    // DEBTS SECTION
    // =================================

    const debtsReport = document.getElementById("debts-report");
    const DEBT_FOR = { loan: "Loan", service: "Service", goods: "Goods / items", bill: "Bill", rent: "Rent", other: "Other" };

    function escapeText(value) {
        return String(value === undefined || value === null ? "" : value)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function todayText() {
        const d = new Date();
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }

    function debtStatus(debt) {
        if (debt.remaining <= 0) return "Paid";
        if (debt.dueDate && debt.dueDate < todayText()) return "Overdue";
        return "Open";
    }

    async function loadDebtsReport() {
        if (!debtsReport) return;

        let debts;
        try {
            const token = localStorage.getItem("cashbookToken");
            const response = await fetch("http://localhost:5000/api/debts", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Unable to load debts.");
            debts = data.debts || [];
        } catch (error) {
            console.error("Error loading debts report:", error);
            debtsReport.innerHTML = '<p class="text-sm text-slate-500 dark:text-slate-400">Could not load your debts.</p>';
            return;
        }

        if (!debts.length) {
            debtsReport.innerHTML = '<p class="text-sm text-slate-500 dark:text-slate-400">No debts recorded yet. Add them on the Debts page.</p>';
            return;
        }

        let toMe = 0, toThem = 0, overdue = 0;
        debts.forEach(function (d) {
            if (d.remaining > 0) {
                if (d.direction === "i_owe") toThem += d.remaining; else toMe += d.remaining;
                if (debtStatus(d) === "Overdue") overdue++;
            }
        });

        const rank = { Overdue: 0, Open: 1, Paid: 2 };
        const rows = debts.slice().sort(function (a, b) {
            const ra = rank[debtStatus(a)], rb = rank[debtStatus(b)];
            if (ra !== rb) return ra - rb;
            return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
        });

        const box = function (label, value, color) {
            return '<div class="rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/70 p-4 min-w-0">' +
                '<p class="text-sm text-slate-500 dark:text-slate-400">' + label + "</p>" +
                '<p class="mt-1 text-xl font-semibold truncate ' + color + '">' + value + "</p></div>";
        };

        const statusColor = { Overdue: "text-red-500", Paid: "text-green", Open: "text-slate-700 dark:text-slate-300" };

        debtsReport.innerHTML =
            '<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">' +
                box("Owed to you (unpaid)", formatNaira(toMe), "text-green") +
                box("You owe (unpaid)", formatNaira(toThem), toThem > 0 ? "text-red-500" : "text-slate-900 dark:text-white") +
                box("Overdue debts", String(overdue), overdue > 0 ? "text-red-500" : "text-slate-900 dark:text-white") +
            "</div>" +
            '<div class="overflow-x-auto -mx-5 px-5">' +
            '<table class="w-full text-sm min-w-[640px]">' +
                '<thead><tr class="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/70">' +
                    '<th class="py-2 pr-3 font-medium">Person</th><th class="py-2 pr-3 font-medium">Type</th><th class="py-2 pr-3 font-medium">For</th>' +
                    '<th class="py-2 pr-3 font-medium">Due</th><th class="py-2 pr-3 font-medium text-right">Amount</th>' +
                    '<th class="py-2 pr-3 font-medium text-right">Paid</th><th class="py-2 pr-3 font-medium text-right">Left</th><th class="py-2 font-medium">Status</th>' +
                "</tr></thead><tbody class=\"divide-y divide-slate-100 dark:divide-slate-700/50\">" +
                rows.map(function (d) {
                    const status = debtStatus(d);
                    return "<tr>" +
                        '<td class="py-2.5 pr-3 font-medium text-slate-900 dark:text-slate-100">' + escapeText(d.personName) + "</td>" +
                        '<td class="py-2.5 pr-3 text-slate-600 dark:text-slate-300">' + (d.direction === "i_owe" ? "I owe" : "Owed to me") + "</td>" +
                        '<td class="py-2.5 pr-3 text-slate-600 dark:text-slate-300">' + escapeText(DEBT_FOR[d.category] || "-") + "</td>" +
                        '<td class="py-2.5 pr-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">' + escapeText(d.dueDate || "-") + "</td>" +
                        '<td class="py-2.5 pr-3 text-right whitespace-nowrap">' + formatNaira(d.amount) + "</td>" +
                        '<td class="py-2.5 pr-3 text-right whitespace-nowrap">' + formatNaira(d.amountPaid) + "</td>" +
                        '<td class="py-2.5 pr-3 text-right font-semibold whitespace-nowrap">' + formatNaira(d.remaining) + "</td>" +
                        '<td class="py-2.5 font-medium ' + statusColor[status] + '">' + status + "</td></tr>";
                }).join("") +
            "</tbody></table></div>";
    }

    // =================================
    // INITIAL REPORT
    // =================================

    loadTransactions();
    loadDebtsReport();

});