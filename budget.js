document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    // =========================================
    // 1. CHECK USER LOGIN & DISPLAY PROFILE
    // =========================================
    const user = JSON.parse(localStorage.getItem("cashbookUser")) || null;

    if (!user) {
        window.location.href = "index.html";
        return;
    }

    const fullName = user.fullName || user.name || user.username || "CashBook User";
    const email = user.email || "No email available";

    const names = fullName.trim().split(/\s+/);
    let initials = names[0].charAt(0).toUpperCase();
    if (names.length > 1) {
        initials += names[names.length - 1].charAt(0).toUpperCase();
    }

    const profileInitials = document.getElementById("profile-initials");
    const profileHeaderInitials = document.getElementById("profileHeaderInitials");
    const userHeaderName = document.getElementById("user-name-header");
    const headerUserName = document.getElementById("header-user-name");

    if (profileInitials) profileInitials.textContent = initials;
    if (profileHeaderInitials) profileHeaderInitials.textContent = initials;
    if (userHeaderName) userHeaderName.textContent = names[0];
    if (headerUserName) headerUserName.textContent = names[0];

    // =========================================
    // 2. ELEMENTS & KEYS
    // =========================================
    const budgetAmountElement = document.getElementById("budget-amount");
    const budgetSpentElement = document.getElementById("budget-spent");
    const budgetRemainingElement = document.getElementById("budget-remaining");
    const budgetPercentageElement = document.getElementById("budget-percentage");
    const budgetProgress = document.getElementById("budget-progress");
    const budgetMessage = document.getElementById("budget-message");
    const goalsList = document.getElementById("goals-list");

    // =========================================
    // API SETUP (MongoDB via Express backend)
    // =========================================
    const API_URL = "http://localhost:5000/api";
    const token = localStorage.getItem("cashbookToken");

    if (!token) {
        window.location.href = "index.html";
        return;
    }

    async function apiRequest(path, method = "GET", body = null) {
        const response = await fetch(API_URL + path, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: body ? JSON.stringify(body) : undefined
        });

        const data = await response.json();

        if (response.status === 401) {
            localStorage.removeItem("cashbookToken");
            localStorage.removeItem("cashbookUser");
            window.location.href = "index.html";
            throw new Error("Session expired. Please log in again.");
        }

        if (!response.ok) {
            throw new Error(data.message || "Request failed.");
        }

        return data;
    }

    // Data loaded from MongoDB
    let transactions = [];
    let monthlyBudget = 0;
    let goals = [];

    function formatNaira(amount) {
        return new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
            minimumFractionDigits: 2
        }).format(Number(amount) || 0);
    }

    function getTransactions() {
        return transactions;
    }

    function getMonthlyExpenses() {
        const transactions = getTransactions();
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        return transactions
            .filter(function (transaction) {
                if (transaction.type !== "expense") return false;
                const transactionDate = new Date(transaction.date + "T00:00:00");
                return (
                    transactionDate.getMonth() === currentMonth &&
                    transactionDate.getFullYear() === currentYear
                );
            })
            .reduce(function (total, transaction) {
                return total + Number(transaction.amount || 0);
            }, 0);
    }

    function displayBudget() {
        const savedBudget = monthlyBudget;
        const spent = getMonthlyExpenses();
        const remaining = savedBudget - spent;
        let percentage = savedBudget > 0 ? (spent / savedBudget) * 100 : 0;
        const progressWidth = Math.min(percentage, 100);

        if (budgetAmountElement) budgetAmountElement.textContent = formatNaira(savedBudget);
        if (budgetSpentElement) budgetSpentElement.textContent = formatNaira(spent);
        if (budgetRemainingElement) budgetRemainingElement.textContent = formatNaira(Math.max(remaining, 0));

        if (budgetPercentageElement) {
            budgetPercentageElement.textContent = percentage > 100 
                ? `-${Math.round(percentage - 100)}%` 
                : `${Math.round(percentage)}%`;
        }

        if (budgetProgress) {
            budgetProgress.style.width = `${progressWidth}%`;
            budgetProgress.classList.remove("bg-emerald-500", "bg-amber-500", "bg-red-500");

            if (percentage >= 100) budgetProgress.classList.add("bg-red-500");
            else if (percentage >= 80) budgetProgress.classList.add("bg-amber-500");
            else budgetProgress.classList.add("bg-emerald-500");
        }

        if (budgetMessage) {
            if (savedBudget === 0) budgetMessage.textContent = "Set a budget to start tracking your spending.";
            else if (percentage >= 100) budgetMessage.textContent = "You have reached or exceeded your monthly budget.";
            else if (percentage >= 80) budgetMessage.textContent = "You are getting close to your monthly budget.";
            else budgetMessage.textContent = "Your spending is within your monthly budget.";
        }
    }

    function getGoals() {
        return goals;
    }

    function displayGoals() {
        if (!goalsList) return;
        const goals = getGoals();

        if (goals.length === 0) {
            goalsList.innerHTML = `
                <div class="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white dark:bg-slate-800 p-8 text-center">
                    <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-navy dark:text-white">
                        <i class="fas fa-bullseye"></i>
                    </div>
                    <h3 class="font-semibold text-slate-800 dark:text-slate-100">No savings goals yet</h3>
                    <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Create your first savings goal to start tracking your progress.
                    </p>
                </div>
            `;
            return;
        }

        goalsList.innerHTML = goals.map(function (goal) {
            const target = Number(goal.target) || 0;
            const saved = Number(goal.saved) || 0;
            const percentage = target > 0 ? (saved / target) * 100 : 0;
            const progress = Math.min(percentage, 100);

            let goalProgressColor = "bg-navy";
            if (percentage >= 100) goalProgressColor = "bg-emerald-500";
            else if (percentage >= 80) goalProgressColor = "bg-amber-500";

            return `
                <div class="rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800 p-5 shadow-sm">
                    <div class="mb-4 flex items-start justify-between gap-3">
                        <div class="flex min-w-0 items-center gap-3">
                            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-navy dark:text-slate-100">
                                <i class="fas fa-bullseye"></i>
                            </div>
                            <div class="min-w-0">
                                <h3 class="truncate font-semibold text-slate-800 dark:text-slate-100">${goal.name}</h3>
                                <p class="text-xs text-slate-500 dark:text-slate-400">Savings Goal</p>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button type="button" class="edit-goal text-xs text-navy dark:text-green hover:underline" data-id="${goal.id}">Edit</button>
                            <button type="button" class="delete-goal text-xs text-red-500 hover:underline" data-id="${goal.id}">Delete</button>
                        </div>
                    </div>
                    <div class="mb-2 flex items-center justify-between text-sm">
                        <span class="text-slate-500 dark:text-slate-400">Saved</span>
                        <span class="font-semibold text-slate-800 dark:text-slate-100">${formatNaira(saved)}</span>
                    </div>
                    <div class="mb-2 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        <div class="h-full rounded-full ${goalProgressColor} transition-all duration-300" style="width: ${progress}%"></div>
                    </div>
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-slate-500 dark:text-slate-400">${Math.round(progress)}% complete</span>
                        <span class="font-medium text-slate-600 dark:text-slate-300">Target: ${formatNaira(target)}</span>
                    </div>
                    <div class="mt-4 flex justify-between border-t border-slate-100 dark:border-slate-700/60 pt-4">
                        <span class="text-sm text-slate-500 dark:text-slate-400">Remaining</span>
                        <span class="font-semibold text-emerald-600 dark:text-emerald-400">${formatNaira(Math.max(target - saved, 0))}</span>
                    </div>
                </div>
            `;
        }).join("");
    }

    // =========================================
    // 3. BUDGET & GOAL MODAL EVENT HANDLERS
    // =========================================
    const budgetModal = document.getElementById("budget-modal");
    const budgetForm = document.getElementById("budget-form");
    const budgetInput = document.getElementById("budget-input");

    document.getElementById("edit-budget-button")?.addEventListener("click", function () {
        if (budgetInput) budgetInput.value = monthlyBudget || "";
        budgetModal?.showModal();
    });

    document.getElementById("close-budget-modal")?.addEventListener("click", () => budgetModal?.close());
    document.getElementById("cancel-budget")?.addEventListener("click", () => budgetModal?.close());

    budgetForm?.addEventListener("submit", async function (event) {
        event.preventDefault();
        const budget = Number(budgetInput.value);
        if (!budget || budget <= 0) {
            alert("Please enter a valid budget amount.");
            return;
        }
        try {
            const data = await apiRequest("/budget", "PUT", { amount: budget });
            monthlyBudget = Number(data.budget.amount) || 0;
            budgetModal.close();
            displayBudget();
            // New budget: update the alerts and "money lasts until" panel
            if (window.CashBookInsights) window.CashBookInsights.refresh();
        } catch (error) {
            alert(error.message || "Unable to save budget.");
        }
    });

    const goalModal = document.getElementById("goal-modal");
    const goalForm = document.getElementById("goal-form");
    const goalIdInput = document.getElementById("goal-id");
    const goalNameInput = document.getElementById("goal-name");
    const goalTargetInput = document.getElementById("goal-target");
    const goalSavedInput = document.getElementById("goal-saved");
    const goalModalTitle = document.getElementById("goal-modal-title");

    function openGoalModal(goal = null) {
        goalForm?.reset();
        if (goal) {
            if (goalModalTitle) goalModalTitle.textContent = "Edit Savings Goal";
            if (goalIdInput) goalIdInput.value = goal.id;
            if (goalNameInput) goalNameInput.value = goal.name;
            if (goalTargetInput) goalTargetInput.value = goal.target;
            if (goalSavedInput) goalSavedInput.value = goal.saved;
        } else {
            if (goalModalTitle) goalModalTitle.textContent = "Add Savings Goal";
            if (goalIdInput) goalIdInput.value = "";
            if (goalSavedInput) goalSavedInput.value = "0";
        }
        goalModal?.showModal();
    }

    document.getElementById("add-goal-button")?.addEventListener("click", () => openGoalModal());
    document.getElementById("close-goal-modal")?.addEventListener("click", () => goalModal?.close());
    document.getElementById("cancel-goal")?.addEventListener("click", () => goalModal?.close());

    goalForm?.addEventListener("submit", async function (event) {
        event.preventDefault();
        const name = goalNameInput.value.trim();
        const target = Number(goalTargetInput.value);
        const saved = Number(goalSavedInput.value) || 0;

        if (name === "" || target <= 0 || saved < 0) {
            alert("Please enter valid goal information.");
            return;
        }
        if (saved > target) {
            alert("Amount saved cannot be greater than the target amount.");
            return;
        }

        try {
            if (goalIdInput.value) {
                const data = await apiRequest("/goals/" + goalIdInput.value, "PUT", { name, target, saved });
                goals = goals.map(g => String(g.id) === String(goalIdInput.value)
                    ? { ...data.goal, id: data.goal._id }
                    : g);
            } else {
                const data = await apiRequest("/goals", "POST", { name, target, saved });
                goals.push({ ...data.goal, id: data.goal._id });
            }

            goalModal.close();
            displayGoals();
        } catch (error) {
            alert(error.message || "Unable to save goal.");
        }
    });

    goalsList?.addEventListener("click", async function (event) {
        const editButton = event.target.closest(".edit-goal");
        const deleteButton = event.target.closest(".delete-goal");

        if (editButton) {
            const goal = getGoals().find(item => String(item.id) === String(editButton.dataset.id));
            if (goal) openGoalModal(goal);
        }

        if (deleteButton) {
            if (confirm("Are you sure you want to delete this goal?")) {
                try {
                    await apiRequest("/goals/" + deleteButton.dataset.id, "DELETE");
                    goals = goals.filter(goal => String(goal.id) !== String(deleteButton.dataset.id));
                    displayGoals();
                } catch (error) {
                    alert(error.message || "Unable to delete goal.");
                }
            }
        }
    });

    // =========================================
    // 4. NAVIGATION & LOGOUT
    // =========================================
    const navRoutes = [
        { id: "dashboard-link", target: "dashboard.html" },
        { id: "transactions-link", target: "transactions.html" },
        { id: "budget-link", target: "budget.html" },
        { id: "debts-link", target: "debts.html" },
        { id: "reports-link", target: "reports.html" },
        { id: "profile-link", target: "profile.html" },
        { id: "settings-link", target: "settings.html" }
    ];

    navRoutes.forEach(route => {
        document.getElementById(route.id)?.addEventListener("click", () => {
            window.location.href = route.target;
        });
    });

    document.getElementById("logout-link")?.addEventListener("click", function () {
        if (confirm("Are you sure you want to logout?")) {
            localStorage.removeItem("cashbookUser");
            localStorage.removeItem("cashbookToken");
            window.location.href = "index.html";
        }
    });

    // Initial load from MongoDB, then render
    async function loadBudgetPage() {
        try {
            const [txData, budgetData, goalData] = await Promise.all([
                apiRequest("/transactions"),
                apiRequest("/budget"),
                apiRequest("/goals")
            ]);

            transactions = txData.transactions || [];
            monthlyBudget = Number(budgetData.budget && budgetData.budget.amount) || 0;
            goals = (goalData.goals || []).map(g => ({ ...g, id: g._id }));
        } catch (error) {
            console.error("Error loading budget page:", error);
        }

        displayBudget();
        displayGoals();
    }

    loadBudgetPage();
});