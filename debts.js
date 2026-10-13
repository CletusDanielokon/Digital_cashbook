// debts.js
// The "Debts" page: record people who owe you money, add notes,
// log part-payments, and send a WhatsApp reminder.
document.addEventListener("DOMContentLoaded", function () {

    // =========================================
    // 1. CHECK USER LOGIN
    // =========================================
    let user = null;

    try {
        user = JSON.parse(localStorage.getItem("cashbookUser"));
    } catch (error) {
        user = null;
    }

    const token = localStorage.getItem("cashbookToken");

    if (!user || !token) {
        window.location.href = "index.html";
        return;
    }

    // =========================================
    // 2. SHOW USER INFORMATION
    // =========================================
    const fullName = user.fullName || user.name || user.username || "CashBook User";
    const names = fullName.trim().split(/\s+/);
    let initials = names[0].charAt(0).toUpperCase();
    if (names.length > 1) initials += names[names.length - 1].charAt(0).toUpperCase();

    function setText(id, text) {
        const element = document.getElementById(id);
        if (element) element.textContent = text;
    }

    setText("profile-initials", initials);
    setText("profileHeaderInitials", initials);
    setText("user-name-header", names[0]);
    setText("header-user-name", names[0]);

    // =========================================
    // 3. ELEMENTS
    // =========================================
    const listEl = document.getElementById("debt-list");
    const searchInput = document.getElementById("debt-search");
    const statusSelect = document.getElementById("debt-status");

    const debtModal = document.getElementById("debt-modal");
    const debtForm = document.getElementById("debt-form");
    const debtFormError = document.getElementById("debt-form-error");
    const saveDebtButton = document.getElementById("save-debt");

    const paymentModal = document.getElementById("payment-modal");
    const paymentForm = document.getElementById("payment-form");
    const paymentFormError = document.getElementById("payment-form-error");

    let debts = [];
    let editingId = null;      // debt being edited (null = adding a new one)
    let payingId = null;       // debt receiving a payment
    const openDetails = new Set();   // debts whose payment history is expanded

    // =========================================
    // 4. HELPERS
    // =========================================
    function formatNaira(amount) {
        return new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
            minimumFractionDigits: 2
        }).format(amount || 0);
    }

    // Stop text typed by the user from being read as HTML
    function escapeHTML(value) {
        return String(value === undefined || value === null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // Today's date (local time) as YYYY-MM-DD
    function todayText() {
        const d = new Date();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return d.getFullYear() + "-" + month + "-" + day;
    }

    // "2026-10-12" -> a Date at local midnight
    function parseDay(text) {
        const parts = String(text).split("-").map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    function formatDay(text) {
        if (!text) return "";
        return parseDay(text).toLocaleDateString("en-GB", {
            day: "numeric", month: "short", year: "numeric"
        });
    }

    function daysBetween(fromText, toText) {
        return Math.round((parseDay(toText) - parseDay(fromText)) / 86400000);
    }

    // paid | overdue | open
    function statusOf(debt) {
        if (debt.remaining <= 0) return "paid";
        if (debt.dueDate && debt.dueDate < todayText()) return "overdue";
        return "open";
    }

    function showToast(message, isError) {
        const toast = document.createElement("div");
        toast.setAttribute("role", "status");
        toast.className =
            "fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[100] max-w-[90%] px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg text-white " +
            (isError ? "bg-red-600" : "bg-navy dark:bg-slate-700");
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(function () { toast.remove(); }, 3200);
    }

    function logoutAndLeave() {
        localStorage.removeItem("cashbookToken");
        localStorage.removeItem("cashbookUser");
        window.location.href = "index.html";
    }

    // One place that talks to the backend
    async function api(method, path, body) {
        const response = await fetch("http://localhost:5000/api/debts" + path, {
            method: method,
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            },
            body: body ? JSON.stringify(body) : undefined
        });

        let data = {};
        try { data = await response.json(); } catch (e) { data = {}; }

        if (response.status === 401) {
            logoutAndLeave();
            throw new Error("Please log in again.");
        }
        if (!response.ok) {
            throw new Error(data.message || "Something went wrong. Please try again.");
        }
        return data;
    }

    // Turns a typed phone number into the international digits WhatsApp needs
    function whatsappNumber(phone) {
        const raw = String(phone || "").trim();
        if (!raw) return null;
        let digits = raw.replace(/\D/g, "");
        if (raw.startsWith("+")) return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
        if (digits.startsWith("00")) digits = digits.slice(2);
        else if (/^0[789][01]\d{8}$/.test(digits)) digits = "234" + digits.slice(1);
        else if (/^[789][01]\d{8}$/.test(digits)) digits = "234" + digits;
        return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
    }

    // =========================================
    // 5. LOAD DEBTS
    // =========================================
    async function loadDebts() {
        try {
            const data = await api("GET", "");
            debts = data.debts || [];
            render();
        } catch (error) {
            listEl.innerHTML =
                '<div class="card p-10 text-center text-sm text-slate-500 dark:text-slate-400">' +
                '<p>Could not load your debts. If the server was asleep, wait a moment and try again.</p>' +
                '<button type="button" data-action="retry" class="btn-outline mt-4">Try again</button></div>';
        }
    }

    // =========================================
    // 6. DRAW THE PAGE
    // =========================================
    function updateSummary() {
        let owed = 0, lent = 0, collected = 0, overdue = 0;
        let owedPeople = 0, overduePeople = 0;

        debts.forEach(function (d) {
            lent += d.amount;
            collected += d.amountPaid;
            if (d.remaining > 0) {
                owed += d.remaining;
                owedPeople++;
                if (statusOf(d) === "overdue") {
                    overdue += d.remaining;
                    overduePeople++;
                }
            }
        });

        setText("total-owed", formatNaira(owed));
        setText("total-lent", formatNaira(lent));
        setText("total-collected", formatNaira(collected));
        setText("total-overdue", formatNaira(overdue));

        setText("owed-people", owedPeople === 0
            ? "No one owes you right now"
            : owedPeople + (owedPeople === 1 ? " person still owes you" : " people still owe you"));
        setText("overdue-people", overduePeople === 0
            ? "Nothing is late"
            : overduePeople + (overduePeople === 1 ? " debt is past its due date" : " debts are past their due date"));
    }

    function visibleDebts() {
        const search = searchInput.value.trim().toLowerCase();
        const show = statusSelect.value;

        const rows = debts.filter(function (d) {
            const status = statusOf(d);
            if (show === "unpaid" && status === "paid") return false;
            if (show === "paid" && status !== "paid") return false;
            if (show === "overdue" && status !== "overdue") return false;
            if (search) {
                const text = (d.personName + " " + (d.note || "")).toLowerCase();
                if (!text.includes(search)) return false;
            }
            return true;
        });

        // Overdue first, then the soonest due date, then newest
        const rank = { overdue: 0, open: 1, paid: 2 };
        rows.sort(function (a, b) {
            const ra = rank[statusOf(a)], rb = rank[statusOf(b)];
            if (ra !== rb) return ra - rb;
            const da = a.dueDate || "9999-12-31", db = b.dueDate || "9999-12-31";
            if (da !== db) return da < db ? -1 : 1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        return rows;
    }

    function statusPill(debt) {
        const status = statusOf(debt);
        const today = todayText();

        if (status === "paid") {
            return '<span class="pill bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><i class="fa-solid fa-circle-check"></i> Fully paid</span>';
        }
        if (status === "overdue") {
            const late = daysBetween(debt.dueDate, today);
            return '<span class="pill bg-red-500/10 text-red-600 dark:text-red-400"><i class="fa-solid fa-clock"></i> Overdue by ' +
                late + (late === 1 ? " day" : " days") + "</span>";
        }
        if (debt.dueDate) {
            const left = daysBetween(today, debt.dueDate);
            const label = left === 0 ? "Due today" : "Due in " + left + (left === 1 ? " day" : " days");
            return '<span class="pill bg-amber-500/10 text-amber-600 dark:text-amber-400"><i class="fa-regular fa-calendar"></i> ' + label + "</span>";
        }
        return '<span class="pill bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">No due date</span>';
    }

    function paymentsHTML(debt) {
        if (!debt.payments.length) return "";

        const open = openDetails.has(debt._id) ? " open" : "";
        const rows = debt.payments.slice().sort(function (a, b) {
            return a.date < b.date ? 1 : -1;
        }).map(function (p) {
            return '<li class="flex items-center justify-between gap-3 py-2">' +
                '<div class="min-w-0">' +
                '<p class="text-sm font-medium text-slate-800 dark:text-slate-100">' + formatNaira(p.amount) + "</p>" +
                '<p class="text-xs text-slate-500 dark:text-slate-400 break-words">' + escapeHTML(formatDay(p.date)) +
                (p.note ? " · " + escapeHTML(p.note) : "") + "</p></div>" +
                '<button type="button" data-action="delete-payment" data-id="' + escapeHTML(debt._id) + '" data-payment="' + escapeHTML(p._id) + '" ' +
                'class="shrink-0 w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition" aria-label="Remove this payment">' +
                '<i class="fa-solid fa-trash-can text-xs"></i></button></li>';
        }).join("");

        return '<details class="mt-4 group" data-details="' + escapeHTML(debt._id) + '"' + open + ">" +
            '<summary class="cursor-pointer select-none text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-green">' +
            "Payments received (" + debt.payments.length + ")</summary>" +
            '<ul class="mt-2 divide-y divide-slate-100 dark:divide-slate-700/50">' + rows + "</ul></details>";
    }

    function debtCardHTML(debt) {
        const status = statusOf(debt);
        const id = escapeHTML(debt._id);
        const percent = Math.min(100, Math.round((debt.amountPaid / debt.amount) * 100));
        const barColor = status === "paid" ? "bg-emerald-500" : status === "overdue" ? "bg-red-500" : "bg-green";

        const border = status === "overdue" ? "border-l-4 border-l-red-500" :
            status === "paid" ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-green";

        const canRemind = status !== "paid" && !!debt.phone;

        return '<article class="card p-4 sm:p-5 ' + border + '">' +

            // top row: name + balance
            '<div class="flex items-start justify-between gap-3">' +
                '<div class="min-w-0">' +
                    '<h3 class="text-base font-semibold text-slate-900 dark:text-white break-words">' + escapeHTML(debt.personName) + "</h3>" +
                    '<div class="mt-1.5">' + statusPill(debt) + "</div>" +
                "</div>" +
                '<div class="text-right shrink-0">' +
                    '<p class="text-xl font-semibold ' + (status === "paid" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white") + '">' +
                        (status === "paid" ? formatNaira(debt.amount) : formatNaira(debt.remaining)) + "</p>" +
                    '<p class="text-xs text-slate-500 dark:text-slate-400">' +
                        (status === "paid" ? "fully repaid" : "still owed of " + formatNaira(debt.amount)) + "</p>" +
                "</div>" +
            "</div>" +

            // progress bar
            '<div class="mt-4" aria-hidden="true">' +
                '<div class="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">' +
                    '<div class="h-full rounded-full ' + barColor + '" style="width:' + percent + '%"></div>' +
                "</div>" +
            "</div>" +
            '<p class="mt-1.5 text-xs text-slate-500 dark:text-slate-400">' + percent + "% paid back" +
                (debt.amountPaid > 0 ? " (" + formatNaira(debt.amountPaid) + ")" : "") + "</p>" +

            // dates + phone
            '<p class="mt-3 text-xs text-slate-500 dark:text-slate-400 break-words">' +
                '<i class="fa-regular fa-calendar mr-1"></i>Given ' + escapeHTML(formatDay(debt.dateLent)) +
                (debt.dueDate ? ' &nbsp;·&nbsp; Due ' + escapeHTML(formatDay(debt.dueDate)) : "") +
                (debt.phone ? ' &nbsp;·&nbsp; <i class="fa-solid fa-phone mr-1"></i>' + escapeHTML(debt.phone) : "") +
            "</p>" +

            // note
            (debt.note
                ? '<div class="mt-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/70 px-3 py-2.5">' +
                  '<p class="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5"><i class="fa-regular fa-note-sticky mr-1"></i>Note</p>' +
                  '<p class="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">' + escapeHTML(debt.note) + "</p></div>"
                : "") +

            paymentsHTML(debt) +

            // actions
            '<div class="mt-4 flex flex-wrap gap-2">' +
                (status !== "paid"
                    ? '<button type="button" data-action="pay" data-id="' + id + '" class="btn-primary h-9 px-3"><i class="fa-solid fa-plus text-xs"></i> Record payment</button>'
                    : "") +
                (canRemind
                    ? '<button type="button" data-action="remind" data-id="' + id + '" class="btn-outline h-9 px-3"><i class="fa-brands fa-whatsapp"></i> Remind</button>'
                    : "") +
                '<button type="button" data-action="edit" data-id="' + id + '" class="btn-outline h-9 px-3"><i class="fa-solid fa-pen text-xs"></i> Edit</button>' +
                '<button type="button" data-action="delete" data-id="' + id + '" class="btn-outline h-9 px-3 hover:!bg-red-500/10 hover:!text-red-500 hover:!border-red-500/40"><i class="fa-solid fa-trash-can text-xs"></i> Delete</button>' +
            "</div>" +

        "</article>";
    }

    function render() {
        updateSummary();

        const rows = visibleDebts();

        if (!rows.length) {
            let message;
            if (!debts.length) {
                message = "No debts recorded yet. Press <strong>Add debt</strong> to note down someone who owes you money.";
            } else if (searchInput.value.trim()) {
                message = "No debt matches your search.";
            } else if (statusSelect.value === "overdue") {
                message = "Nothing is overdue. 🎉";
            } else if (statusSelect.value === "paid") {
                message = "No debt has been fully paid yet.";
            } else {
                message = "Everyone has paid you back.";
            }
            listEl.innerHTML =
                '<div class="card p-10 text-center text-sm text-slate-500 dark:text-slate-400">' + message + "</div>";
            return;
        }

        listEl.innerHTML = rows.map(debtCardHTML).join("");
    }

    // =========================================
    // 7. ADD / EDIT A DEBT
    // =========================================
    function showFormError(element, message) {
        element.textContent = message;
        element.classList.remove("hidden");
    }

    function clearFormError(element) {
        element.textContent = "";
        element.classList.add("hidden");
    }

    function openDebtForm(debt) {
        editingId = debt ? debt._id : null;
        clearFormError(debtFormError);

        setText("debt-modal-title", debt ? "Edit debt" : "Add debt");

        document.getElementById("debt-person").value = debt ? debt.personName : "";
        document.getElementById("debt-phone").value = debt ? debt.phone : "";
        document.getElementById("debt-amount").value = debt ? debt.amount : "";
        document.getElementById("debt-date").value = debt ? debt.dateLent : todayText();
        document.getElementById("debt-due").value = debt ? debt.dueDate : "";
        document.getElementById("debt-note").value = debt ? debt.note : "";

        debtModal.showModal();
        document.getElementById("debt-person").focus();
    }

    debtForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        clearFormError(debtFormError);

        const body = {
            personName: document.getElementById("debt-person").value.trim(),
            phone: document.getElementById("debt-phone").value.trim(),
            amount: Number(document.getElementById("debt-amount").value),
            dateLent: document.getElementById("debt-date").value,
            dueDate: document.getElementById("debt-due").value,
            note: document.getElementById("debt-note").value.trim()
        };

        if (!body.personName) return showFormError(debtFormError, "Please enter the name of the person who owes you.");
        if (!(body.amount > 0)) return showFormError(debtFormError, "Please enter an amount greater than zero.");
        if (!body.dateLent) return showFormError(debtFormError, "Please choose the date the money was given.");
        if (body.dueDate && body.dueDate < body.dateLent) {
            return showFormError(debtFormError, "The due date cannot be before the date the money was given.");
        }

        saveDebtButton.disabled = true;

        try {
            const data = editingId
                ? await api("PUT", "/" + editingId, body)
                : await api("POST", "", body);

            if (editingId) {
                debts = debts.map(function (d) { return d._id === editingId ? data.debt : d; });
            } else {
                debts.unshift(data.debt);
            }

            debtModal.close();
            render();
            showToast(editingId ? "Debt updated." : "Debt saved.");
        } catch (error) {
            showFormError(debtFormError, error.message);
        } finally {
            saveDebtButton.disabled = false;
        }
    });

    // =========================================
    // 8. RECORD A PAYMENT
    // =========================================
    function openPaymentForm(debt) {
        payingId = debt._id;
        clearFormError(paymentFormError);

        setText("payment-subtitle", debt.personName + " · " + formatNaira(debt.remaining) + " still owed");

        const amountInput = document.getElementById("payment-amount");
        amountInput.value = "";
        amountInput.max = debt.remaining;
        document.getElementById("payment-date").value = todayText();
        document.getElementById("payment-note").value = "";

        paymentModal.showModal();
        amountInput.focus();
    }

    document.getElementById("payment-fill-all").addEventListener("click", function () {
        const debt = debts.find(function (d) { return d._id === payingId; });
        if (debt) document.getElementById("payment-amount").value = debt.remaining;
    });

    paymentForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        clearFormError(paymentFormError);

        const debt = debts.find(function (d) { return d._id === payingId; });
        if (!debt) return;

        const body = {
            amount: Number(document.getElementById("payment-amount").value),
            date: document.getElementById("payment-date").value,
            note: document.getElementById("payment-note").value.trim()
        };

        if (!(body.amount > 0)) return showFormError(paymentFormError, "Please enter an amount greater than zero.");
        if (body.amount > debt.remaining + 0.001) {
            return showFormError(paymentFormError, "That is more than the " + formatNaira(debt.remaining) + " still owed.");
        }
        if (!body.date) return showFormError(paymentFormError, "Please choose the date you received it.");

        try {
            const data = await api("POST", "/" + payingId + "/payments", body);
            debts = debts.map(function (d) { return d._id === payingId ? data.debt : d; });
            paymentModal.close();
            render();
            showToast(data.debt.remaining <= 0 ? "Fully paid back. 🎉" : "Payment recorded.");
        } catch (error) {
            showFormError(paymentFormError, error.message);
        }
    });

    // =========================================
    // 9. BUTTONS ON EACH DEBT (one listener for all)
    // =========================================
    listEl.addEventListener("click", async function (event) {
        const button = event.target.closest("[data-action]");
        if (!button) return;

        const action = button.dataset.action;
        if (action === "retry") return loadDebts();

        const debt = debts.find(function (d) { return d._id === button.dataset.id; });
        if (!debt) return;

        if (action === "pay") return openPaymentForm(debt);
        if (action === "edit") return openDebtForm(debt);

        if (action === "remind") {
            const number = whatsappNumber(debt.phone);
            if (!number) {
                showToast("That phone number does not look right. Edit the debt to fix it.", true);
                return;
            }
            const due = debt.dueDate ? ", due on " + formatDay(debt.dueDate) : "";
            const message = "Hello " + debt.personName + ", this is a friendly reminder about the " +
                formatNaira(debt.remaining) + " you owe me" + due +
                ". Please let me know when you can pay. Thank you.";
            window.open("https://wa.me/" + number + "?text=" + encodeURIComponent(message), "_blank", "noopener");
            return;
        }

        if (action === "delete") {
            if (!confirm("Delete the debt for " + debt.personName + "? This cannot be undone.")) return;
            try {
                await api("DELETE", "/" + debt._id);
                debts = debts.filter(function (d) { return d._id !== debt._id; });
                render();
                showToast("Debt deleted.");
            } catch (error) {
                showToast(error.message, true);
            }
            return;
        }

        if (action === "delete-payment") {
            if (!confirm("Remove this payment? The balance owed will go back up.")) return;
            try {
                const data = await api("DELETE", "/" + debt._id + "/payments/" + button.dataset.payment);
                debts = debts.map(function (d) { return d._id === debt._id ? data.debt : d; });
                openDetails.add(debt._id);
                render();
                showToast("Payment removed.");
            } catch (error) {
                showToast(error.message, true);
            }
        }
    });

    // Remember which payment lists are expanded so they stay open after a refresh of the cards
    listEl.addEventListener("toggle", function (event) {
        const details = event.target;
        if (!details.dataset || !details.dataset.details) return;
        if (details.open) openDetails.add(details.dataset.details);
        else openDetails.delete(details.dataset.details);
    }, true);

    // =========================================
    // 10. OPEN / CLOSE DIALOGS, FILTERS
    // =========================================
    document.getElementById("add-debt").addEventListener("click", function () { openDebtForm(null); });
    document.getElementById("close-debt-modal").addEventListener("click", function () { debtModal.close(); });
    document.getElementById("cancel-debt-modal").addEventListener("click", function () { debtModal.close(); });
    document.getElementById("close-payment-modal").addEventListener("click", function () { paymentModal.close(); });
    document.getElementById("cancel-payment-modal").addEventListener("click", function () { paymentModal.close(); });

    // Clicking the dark area outside a dialog closes it
    [debtModal, paymentModal].forEach(function (dialog) {
        dialog.addEventListener("click", function (event) {
            if (event.target === dialog) dialog.close();
        });
    });

    searchInput.addEventListener("input", render);
    statusSelect.addEventListener("change", render);

    // =========================================
    // 11. NAVIGATION & LOGOUT
    // =========================================
    const routes = [
        { id: "dashboard-link", target: "dashboard.html" },
        { id: "transactions-link", target: "transactions.html" },
        { id: "budget-link", target: "budget.html" },
        { id: "debts-link", target: "debts.html" },
        { id: "reports-link", target: "reports.html" },
        { id: "profile-link", target: "profile.html" },
        { id: "settings-link", target: "settings.html" }
    ];

    routes.forEach(function (route) {
        const button = document.getElementById(route.id);
        if (button) {
            button.addEventListener("click", function () {
                window.location.href = route.target;
            });
        }
    });

    const logoutButton = document.getElementById("logout-link");
    if (logoutButton) {
        logoutButton.addEventListener("click", function () {
            if (confirm("Are you sure you want to logout?")) logoutAndLeave();
        });
    }

    // =========================================
    // 12. START
    // =========================================
    loadDebts();
});
