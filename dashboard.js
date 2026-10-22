document.addEventListener("DOMContentLoaded", function () {

    // =========================================
    // 1. GET SAVED USER
    // =========================================
    const user = JSON.parse(localStorage.getItem("cashbookUser"));

    // If no user is logged in, return to login page
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    // =========================================
    // 2. GET USER INFORMATION
    // =========================================
    const fullName =
        user.fullName ||
        user.name ||
        user.username ||
        "CashBook User";

    const email =
        user.email ||
        "No email available";

    // =========================================
    // 3. GET USER INITIALS & FIRST NAME
    // =========================================
    const names = fullName.trim().split(/\s+/);
    const firstName = names[0];

    let initials = names[0].charAt(0).toUpperCase();
    if (names.length > 1) {
        initials += names[names.length - 1].charAt(0).toUpperCase();
    }

    // =========================================
    // 4. DOM ELEMENTS (PROFILE & DISPLAY)
    // =========================================
    const profileInitials = document.getElementById("profile-initials");
    const profileHeaderInitials = document.getElementById("profileHeaderInitials");
    const headerUserName = document.getElementById("header-user-name");
    const userNameHeader = document.getElementById("user-name-header");
    const welcomeName = document.getElementById("welcome-name");

    const profileAvatar = document.getElementById("profile-avatar");
    const profileFullName = document.getElementById("profile-full-name");
    const profileEmail = document.getElementById("profile-email");
    const infoFullName = document.getElementById("info-full-name");
    const infoEmail = document.getElementById("info-email");

    // Financial Overview DOM Elements
    const balanceElement = document.getElementById("balance");
    const incomeElement = document.getElementById("income");
    const expensesElement = document.getElementById("expenses");
    const recentTransactionsElement = document.getElementById("recent-transactions");

    // =========================================
    // 5. DISPLAY USER INFORMATION
    // =========================================
    if (profileInitials) profileInitials.textContent = initials;
    if (profileHeaderInitials) profileHeaderInitials.textContent = initials;
    if (headerUserName) headerUserName.textContent = firstName;
    if (userNameHeader) userNameHeader.textContent = firstName;
    if (welcomeName) welcomeName.textContent = firstName;

    if (profileAvatar) profileAvatar.textContent = initials;
    if (profileFullName) profileFullName.textContent = fullName;
    if (profileEmail) profileEmail.textContent = email;
    if (infoFullName) infoFullName.textContent = fullName;
    if (infoEmail) infoEmail.textContent = email;

    // =========================================
    // 6. FORMAT NAIRA
    // =========================================
    function formatNaira(amount) {
        return new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
            minimumFractionDigits: 2
        }).format(Number(amount) || 0);
    }

    // =========================================
    // 7. CALCULATE FINANCES
    // =========================================
    async function calculateFinances() {

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

            const transactions =
                data.transactions || [];

            let totalIncome = 0;

            let totalExpenses = 0;

            transactions.forEach(function (transaction) {

                const amount =
                    Number(transaction.amount) || 0;

                if (transaction.type === "income") {

                    totalIncome += amount;

                }

                if (transaction.type === "expense") {

                    totalExpenses += amount;

                }

            });

            const balance =
                totalIncome - totalExpenses;

            if (incomeElement) {

                incomeElement.textContent =
                    formatNaira(totalIncome);

            }

            if (expensesElement) {

                expensesElement.textContent =
                    formatNaira(totalExpenses);

            }

            if (balanceElement) {

                balanceElement.textContent =
                    formatNaira(balance);

            }

            // Fill in the Budget Overview card
            await updateBudgetOverview(transactions);

            // Update the spending alerts and "money lasts until" panel
            if (window.CashBookInsights) {
                window.CashBookInsights.refresh();
            }

        } catch (error) {

            console.error(
                "Error loading financial summary:",
                error
            );

        }
    }
    
    // =========================================
    // 7b. BUDGET OVERVIEW CARD
    // =========================================
    const budgetOverviewList = document.getElementById("budget-overview-list");
    let savedMonthlyBudget = null;   // loaded once, then reused

    async function loadMonthlyBudget() {
        if (savedMonthlyBudget !== null) return savedMonthlyBudget;

        const token = localStorage.getItem("cashbookToken");
        const response = await fetch("http://localhost:5000/api/budget", {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to load budget.");
        }

        savedMonthlyBudget = Number(data.budget && data.budget.amount) || 0;
        return savedMonthlyBudget;
    }

    async function updateBudgetOverview(transactions) {
        if (!budgetOverviewList) return;

        let budget;
        try {
            budget = await loadMonthlyBudget();
        } catch (error) {
            console.error("Error loading budget overview:", error);
            budgetOverviewList.innerHTML =
                '<p class="text-sm text-slate-500 dark:text-slate-400">Could not load your budget. Please refresh the page.</p>';
            return;
        }

        // Spending in the current month, in total and by category
        const now = new Date();
        let spent = 0;
        const byCategory = {};

        (transactions || []).forEach(function (transaction) {
            if (transaction.type !== "expense") return;
            const date = new Date(transaction.date + "T00:00:00");
            if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return;

            const amount = Number(transaction.amount) || 0;
            spent += amount;
            const category = transaction.category || "Other";
            byCategory[category] = (byCategory[category] || 0) + amount;
        });

        // No budget yet: invite the user to set one
        if (budget <= 0) {
            budgetOverviewList.innerHTML =
                '<div class="text-center py-4">' +
                '<p class="text-sm font-medium text-slate-900 dark:text-slate-100">No monthly budget set yet</p>' +
                '<p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Set one to see how much of it you have used.</p>' +
                (spent > 0
                    ? '<p class="text-sm text-slate-500 dark:text-slate-400 mt-3">Spent this month: <span class="font-semibold text-slate-900 dark:text-slate-100">' + formatNaira(spent) + "</span></p>"
                    : "") +
                "</div>";
            return;
        }

        const remaining = budget - spent;
        const percentage = (spent / budget) * 100;
        const barWidth = Math.min(100, Math.max(0, percentage));

        let barColor = "bg-green";
        let message = "Your spending is within your monthly budget.";
        let messageColor = "text-slate-500 dark:text-slate-400";

        if (percentage >= 100) {
            barColor = "bg-red-500";
            message = "You have reached or exceeded your monthly budget.";
            messageColor = "text-red-500";
        } else if (percentage >= 80) {
            barColor = "bg-amber-500";
            message = "You are getting close to your monthly budget.";
            messageColor = "text-amber-600 dark:text-amber-400";
        }

        // Top three spending categories this month
        const top = Object.keys(byCategory)
            .map(function (name) { return { name: name, amount: byCategory[name] }; })
            .sort(function (a, b) { return b.amount - a.amount; })
            .slice(0, 3);

        const topHTML = top.length
            ? '<div class="pt-4 border-t border-slate-200 dark:border-slate-700/70">' +
              '<p class="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Top spending this month</p>' +
              '<ul class="space-y-1.5">' +
              top.map(function (item) {
                  return '<li class="flex items-center justify-between gap-3 text-sm">' +
                      '<span class="truncate text-slate-700 dark:text-slate-300">' + escapeHTML(item.name) + "</span>" +
                      '<span class="shrink-0 font-medium text-slate-900 dark:text-slate-100">' + formatNaira(item.amount) + "</span></li>";
              }).join("") +
              "</ul></div>"
            : "";

        budgetOverviewList.innerHTML =
            '<div class="flex items-end justify-between gap-3">' +
                '<div class="min-w-0"><p class="text-xs text-slate-500 dark:text-slate-400">Spent this month</p>' +
                '<p class="text-xl font-semibold text-slate-900 dark:text-white truncate">' + formatNaira(spent) + "</p></div>" +
                '<div class="text-right min-w-0"><p class="text-xs text-slate-500 dark:text-slate-400">Budget</p>' +
                '<p class="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">' + formatNaira(budget) + "</p></div>" +
            "</div>" +
            '<div>' +
                '<div class="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(barWidth) + '" aria-label="Budget used">' +
                    '<div class="h-full rounded-full ' + barColor + '" style="width:' + barWidth + '%"></div>' +
                "</div>" +
                '<div class="flex items-center justify-between mt-1.5 text-xs text-slate-500 dark:text-slate-400">' +
                    "<span>" + Math.round(percentage) + "% used</span>" +
                    "<span>" + (remaining >= 0 ? formatNaira(remaining) + " left" : formatNaira(Math.abs(remaining)) + " over") + "</span>" +
                "</div>" +
            "</div>" +
            '<p class="text-sm ' + messageColor + '">' + message + "</p>" +
            topHTML;
    }

    // =========================================
    // 7c. HIDE / SHOW BALANCES
    // =========================================
    const toggleBalancesButton = document.getElementById("toggle-balances");

    function applyHideBalances(hidden) {
        document.body.classList.toggle("hide-money", hidden);
        if (!toggleBalancesButton) return;
        toggleBalancesButton.setAttribute("aria-pressed", hidden ? "true" : "false");
        const icon = document.getElementById("toggle-balances-icon");
        if (icon) icon.className = hidden ? "fa-regular fa-eye" : "fa-regular fa-eye-slash";
        const label = document.getElementById("toggle-balances-text");
        if (label) label.textContent = hidden ? "Show balances" : "Hide balances";
    }

    let balancesHidden = false;
    try { balancesHidden = localStorage.getItem("cashbookHideBalances") === "1"; } catch (e) { /* ignore */ }
    applyHideBalances(balancesHidden);

    if (toggleBalancesButton) {
        toggleBalancesButton.addEventListener("click", function () {
            balancesHidden = !balancesHidden;
            try { localStorage.setItem("cashbookHideBalances", balancesHidden ? "1" : "0"); } catch (e) { /* ignore */ }
            applyHideBalances(balancesHidden);
        });
    }

    // =========================================
    // 7d. DEBTS CARD
    // =========================================
    const debtsOverview = document.getElementById("debts-overview");

    function todayText() {
        const d = new Date();
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }

    function daysUntil(dateText) {
        const a = new Date(todayText() + "T00:00:00");
        const b = new Date(dateText + "T00:00:00");
        return Math.round((b - a) / 86400000);
    }

    async function loadDebtsOverview() {
        if (!debtsOverview) return;

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
            console.error("Error loading debts overview:", error);
            debtsOverview.innerHTML = '<p class="text-sm text-slate-500 dark:text-slate-400 sm:col-span-3">Could not load your debts.</p>';
            return;
        }

        const open = debts.filter(function (d) { return d.remaining > 0; });

        if (!open.length) {
            debtsOverview.innerHTML =
                '<div class="sm:col-span-3">' +
                '<p class="text-sm font-medium text-slate-900 dark:text-slate-100">Nothing outstanding</p>' +
                '<p class="text-sm text-slate-500 dark:text-slate-400">Record money people owe you, or money you owe, on the Debts page.</p></div>';
            return;
        }

        let toMe = 0, toThem = 0, countToMe = 0, countToThem = 0, overdue = 0;
        let soonest = null;

        open.forEach(function (d) {
            const iOwe = d.direction === "i_owe";
            if (iOwe) { toThem += d.remaining; countToThem++; }
            else { toMe += d.remaining; countToMe++; }

            if (d.dueDate) {
                const days = daysUntil(d.dueDate);
                if (days < 0) overdue++;
                else if (days <= 7 && (!soonest || days < soonest.days)) {
                    soonest = { days: days, name: d.personName, iOwe: iOwe };
                }
            }
        });

        const box = function (label, amount, count, color) {
            return '<div class="rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/70 p-4 min-w-0">' +
                '<p class="text-sm text-slate-500 dark:text-slate-400">' + label + '</p>' +
                '<p class="mt-1 text-xl font-semibold truncate ' + color + '">' + formatNaira(amount) + '</p>' +
                '<p class="mt-1 text-xs text-slate-500 dark:text-slate-400">' + (count === 0 ? "No one" : count + (count === 1 ? " person" : " people")) + '</p></div>';
        };

        let notice;
        if (overdue > 0) {
            notice = '<p class="text-sm font-medium text-red-500"><i class="fa-solid fa-clock mr-1"></i>' +
                overdue + (overdue === 1 ? " debt is" : " debts are") + " past its due date.</p>" +
                '<p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Open Debts to see which ones.</p>';
        } else if (soonest) {
            const when = soonest.days === 0 ? "today" : "in " + soonest.days + (soonest.days === 1 ? " day" : " days");
            notice = '<p class="text-sm font-medium text-amber-600 dark:text-amber-400"><i class="fa-regular fa-calendar mr-1"></i>' +
                (soonest.iOwe ? "You pay " : "") + escapeHTML(soonest.name) + (soonest.iOwe ? "" : " is due") + " " + when + ".</p>" +
                '<p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Due within the next 7 days.</p>';
        } else {
            notice = '<p class="text-sm font-medium text-green"><i class="fa-solid fa-circle-check mr-1"></i>Nothing is late.</p>' +
                '<p class="mt-1 text-xs text-slate-500 dark:text-slate-400">No payments due in the next 7 days.</p>';
        }

        debtsOverview.innerHTML =
            box("Owed to you", toMe, countToMe, "text-green") +
            box("You owe", toThem, countToThem, "text-red-500") +
            '<div class="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-4 flex flex-col justify-center min-w-0">' + notice + "</div>";
    }

    // Paperclip on a recent transaction opens its teller / receipt
    if (recentTransactionsElement) {
        recentTransactionsElement.addEventListener("click", function (event) {
            const button = event.target.closest("[data-receipt]");
            if (button && window.CashbookReceipt) window.CashbookReceipt.view(button.dataset.receipt);
        });
    }

    // =========================================
    // 8. DISPLAY RECENT TRANSACTIONS
    // =========================================
    async function displayRecentTransactions() {

        if (!recentTransactionsElement) {
            return;
        }

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

            const transactions =
                data.transactions || [];

            const recentTransactions =
                transactions.slice(0, 6);

            if (recentTransactions.length === 0) {

                recentTransactionsElement.innerHTML = `
                    <p class="p-5 text-sm text-slate-500 dark:text-slate-400">
                        No transactions yet.
                    </p>
                `;

                return;
            }

            recentTransactionsElement.innerHTML =
                recentTransactions.map(function (transaction) {

                    const isIncome =
                        transaction.type === "income";

                    const sign =
                        isIncome ? "+" : "-";

                    const amountClass =
                        isIncome
                        ? "text-green"
                        : "text-red-500";

                    const iconClass =
                        isIncome
                        ? "fas fa-arrow-trend-up text-green"
                        : "fas fa-arrow-trend-down text-red-500";

                    const description =
                        transaction.description ||
                        "Unnamed transaction";

                    const category =
                        transaction.category ||
                        "Other";

                    const date =
                        transaction.date ||
                        "";

                    const time =
                        transaction.time ||
                        "";

                    return `
                        <div class="p-5 flex items-center justify-between gap-3">

                            <div class="flex items-center gap-3">

                                <div class="w-10 h-10 rounded-full ${
                                    isIncome
                                    ? "bg-green/10"
                                    : "bg-red-50 dark:bg-red-500/10"
                                } flex items-center justify-center">

                                    <i class="${iconClass}"></i>

                                </div>

                                <div>

                                    <p class="font-medium text-navy dark:text-white">
                                        ${escapeHTML(description)}
                                    </p>

                                    <p class="text-xs text-slate-500 dark:text-slate-400">
                                        ${escapeHTML(category)}
                                        •
                                        ${escapeHTML(date)}
                                        ${
                                            time
                                            ? " • " + escapeHTML(time)
                                            : ""
                                        }
                                    </p>

                                </div>

                            </div>

                            <div class="flex items-center gap-2 shrink-0">
                                ${transaction.attachment ? `
                                <button type="button" data-receipt="${escapeHTML(transaction.attachment)}" class="w-8 h-8 flex items-center justify-center rounded-lg text-green hover:bg-green/10 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green/50" aria-label="View the teller or receipt" title="View teller / receipt">
                                    <i class="fa-solid fa-paperclip text-xs"></i>
                                </button>` : ""}
                                <p class="font-semibold ${amountClass}">
                                    ${sign}${formatNaira(transaction.amount)}
                                </p>
                            </div>

                        </div>
                    `;

                }).join("");

        } catch (error) {

            console.error(
                "Error loading recent transactions:",
                error
            );

        }
    }

    // =========================================
    // 9. ESCAPE HTML (SECURITY)
    // =========================================
    function escapeHTML(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // =========================================
    // 10. NAVIGATION HANDLERS
    // =========================================
    const routes = [
        { id: "dashboard-link", target: "dashboard.html" },
        { id: "transactions-link", target: "transactions.html" },
        { id: "view-transactions", target: "transactions.html" },
        { id: "see-all", target: "transactions.html" },
        { id: "budget-link", target: "budget.html" },
        { id: "debts-link", target: "debts.html" },
        { id: "view-budget", target: "budget.html" },
        { id: "view-debts", target: "debts.html" },
        { id: "reports-link", target: "reports.html" },
        { id: "profile-link", target: "profile.html" },
        { id: "settings-link", target: "settings.html" }
    ];

    routes.forEach(route => {
        const btn = document.getElementById(route.id);
        if (btn) {
            btn.addEventListener("click", function () {
                window.location.href = route.target;
            });
        }
    });

    // =========================================
    // 11. LOGOUT
    // =========================================
    const logoutBtn = document.getElementById("logout-link");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", function () {
            if (confirm("Are you sure you want to logout?")) {
                localStorage.removeItem("cashbookUser");
                localStorage.removeItem("cashbookToken");
                window.location.href = "index.html";
            }
        });
    }

    // =========================================
    // 12. TRANSACTION MODAL LOGIC
    // =========================================
    const modal = document.getElementById("transactionModal");
    const modalTitle = document.getElementById("modalTitle");
    const transactionTypeInput = document.getElementById("transactionType");
    const transactionForm = document.getElementById("transactionForm");
    const transactionDateInput = document.getElementById("transactionDate");
    const transactionTimeInput = document.getElementById("transactionTime");
    const addIncomeButton = document.getElementById("add-income");
    const addExpenseButton = document.getElementById("add-expense");

    const modalCloseButtons = document.querySelectorAll(
        '#transactionModal button[onclick="closeModal()"]'
    );

    function setCurrentDateAndTime() {
        const now = new Date();
        const currentDate =
            now.getFullYear() +
            "-" +
            String(now.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(now.getDate()).padStart(2, "0");

        const currentTime =
            String(now.getHours()).padStart(2, "0") +
            ":" +
            String(now.getMinutes()).padStart(2, "0");

        if (transactionDateInput) transactionDateInput.value = currentDate;
        if (transactionTimeInput) transactionTimeInput.value = currentTime;
    }

    // Teller / receipt: take a photo or upload one (optional), and scan it to fill the form
    const receiptHolder = document.getElementById("receipt-widget");

    const receiptWidget = (receiptHolder && window.CashbookReceipt)
        ? window.CashbookReceipt.mount(receiptHolder, {
            scan: true,
            onScan: function (found) {
                window.CashbookReceipt.fillTransactionForm(found, {
                    amount: "amount",
                    description: "description",
                    date: "transactionDate",
                    time: "transactionTime",
                    category: "category"
                });

                // A scanned credit alert is income, a receipt is an expense
                if (found.type === "income" || found.type === "expense") {
                    if (transactionTypeInput) transactionTypeInput.value = found.type;
                    if (modalTitle) modalTitle.textContent = found.type === "income" ? "Add Income" : "Add Expense";
                }
            }
        })
        : null;

    // A picture that was uploaded for a save that then failed is not kept
    function dropPicture(picture) {
        if (picture && picture.uploaded && window.CashbookReceipt) {
            window.CashbookReceipt.discard(picture.value);
        }
    }

    function openModal(type) {
        if (!modal) return;

        if (receiptWidget) receiptWidget.reset();

        if (transactionTypeInput) transactionTypeInput.value = type;

        if (modalTitle) {
            modalTitle.textContent = type === "income" ? "Add Income" : "Add Expense";
        }

        setCurrentDateAndTime();
        modal.showModal();
    }

    function closeModal() {
        if (modal && modal.open) {
            modal.close();
        }
    }

    window.openModal = openModal;
    window.closeModal = closeModal;

    if (addIncomeButton) {
        addIncomeButton.addEventListener("click", function () {
            openModal("income");
        });
    }

    if (addExpenseButton) {
        addExpenseButton.addEventListener("click", function () {
            openModal("expense");
        });
    }

    modalCloseButtons.forEach(function (button) {
        button.addEventListener("click", function (event) {
            event.preventDefault();
            closeModal();
        });
    });

    if (transactionForm) {
        transactionForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const descriptionInput = document.getElementById("description");
            const amountInput = document.getElementById("amount");
            const categoryInput = document.getElementById("category");

            const description = descriptionInput.value.trim();
            const amount = Number(amountInput.value);
            const category = categoryInput.value;
            const date = transactionDateInput.value;
            let time = transactionTimeInput.value;
            const type = transactionTypeInput.value;

            if (!time) {
                const now = new Date();
                time =
                    String(now.getHours()).padStart(2, "0") +
                    ":" +
                    String(now.getMinutes()).padStart(2, "0");
            }

            if (
                description === "" ||
                !Number.isFinite(amount) ||
                amount <= 0 ||
                category === "" ||
                date === "" ||
                type === ""
            ) {
                alert("Please fill in all required fields correctly.");
                return;
            }

            const token =
                localStorage.getItem("cashbookToken");

            if (!token) {
                alert("Your login session has expired. Please log in again.");
                window.location.href = "index.html";
                return;
            }

            // Save the teller / receipt picture first (only if one was chosen)
            let picture = { value: undefined };

            if (receiptWidget) {
                try {
                    picture = await receiptWidget.prepare();
                } catch (error) {
                    alert(error.message || "Unable to save the picture.");
                    return;
                }
            }

            try {
                const response = await fetch(
                    "http://localhost:5000/api/transactions",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            description: description,
                            amount: amount,
                            date: date,
                            time: time,
                            category: category,
                            type: type,
                            ...(picture.value !== undefined ? { attachment: picture.value } : {})
                        })
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    dropPicture(picture);
                    alert(
                        data.message ||
                        "Unable to save transaction."
                    );
                    return;
                }

                transactionForm.reset();
                closeModal();

                await calculateFinances();
                await displayRecentTransactions();

                alert("Transaction saved successfully!");

            } catch (error) {
                dropPicture(picture);
                console.error(
                    "Dashboard transaction error:",
                    error
                );

                alert(
                    "Unable to connect to the CashBook server."
                );
            }
        });
    }

    // =========================================
    // 13. INITIAL PAGE DISPLAY
    // =========================================
    calculateFinances();
    displayRecentTransactions();
    loadDebtsOverview();
});