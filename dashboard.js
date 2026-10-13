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

                            <p class="font-semibold ${amountClass}">
                                ${sign}${formatNaira(transaction.amount)}
                            </p>

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

    function openModal(type) {
        if (!modal) return;

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
                            type: type
                        })
                    }
                );

                const data = await response.json();

                if (!response.ok) {
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
});