// insights.js
// Budget alerts and the "money lasts until" estimate.
//
// Shows a panel on the Dashboard and on the Budget page (any element with id="insights-panel").
// It reads the user's transactions and monthly budget from the API and works out:
//   1. How much of the monthly budget is used, with a warning at 80% and an alert at 100%.
//   2. At the current spending pace, the date the monthly budget runs out.
//   3. At the current spending pace, the date the whole balance runs out.
//
// The maths is in compute() so it can be tested without a browser.

(function (root) {
    "use strict";

    var DAY = 24 * 60 * 60 * 1000;

    function startOfDay(d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function parseDay(str) {
        // "2026-10-07" -> local midnight
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(str || ""));
        return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
    }

    function daysBetween(a, b) {
        return Math.round((startOfDay(b) - startOfDay(a)) / DAY);
    }

    function addDays(d, n) {
        var x = startOfDay(d);
        x.setDate(x.getDate() + n);
        return x;
    }

    function money(n) {
        return new Intl.NumberFormat("en-NG", {
            style: "currency", currency: "NGN", maximumFractionDigits: 0
        }).format(Math.round(Number(n) || 0));
    }

    function niceDate(d) {
        return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    }

    function plural(n, word) {
        return n + " " + word + (n === 1 ? "" : "s");
    }

    // transactions: [{type, amount, date:"YYYY-MM-DD"}], budgetAmount: number, now: Date
    function compute(transactions, budgetAmount, nowDate) {
        var now = startOfDay(nowDate || new Date());
        var list = Array.isArray(transactions) ? transactions : [];
        var budget = Number(budgetAmount) || 0;

        var income = 0, expense = 0;
        var monthSpent = 0;
        var last30Spent = 0;
        var first = null;

        list.forEach(function (t) {
            var amount = Number(t.amount) || 0;
            var day = parseDay(t.date);
            if (!day || amount <= 0) return;
            if (day > now) return; // ignore future-dated entries

            if (!first || day < first) first = day;

            if (t.type === "income") income += amount;
            else if (t.type === "expense") {
                expense += amount;
                if (day.getFullYear() === now.getFullYear() && day.getMonth() === now.getMonth()) monthSpent += amount;
                if (daysBetween(day, now) < 30) last30Spent += amount;
            }
        });

        var balance = income - expense;
        var daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        var monthEnd = new Date(now.getFullYear(), now.getMonth(), daysInMonth);
        var daysLeftInMonth = daysBetween(now, monthEnd);

        // Daily spending pace: the last 30 days, but never divide by more days than the user has been recording.
        var window = first ? Math.min(30, Math.max(1, daysBetween(first, now) + 1)) : 1;
        var dailyPace = last30Spent / window;

        var result = {
            balance: balance,
            monthSpent: monthSpent,
            dailyPace: dailyPace,
            alerts: [],
            budget: null,
            balanceRunway: null
        };

        // ---- Budget usage and alerts ----
        if (budget > 0) {
            var percent = (monthSpent / budget) * 100;
            var remaining = budget - monthSpent;
            var level = percent >= 100 ? "danger" : percent >= 80 ? "warn" : "ok";

            var b = { amount: budget, percent: percent, remaining: remaining, level: level, runsOutOn: null, daysUntilEmpty: null, lastsToMonthEnd: null };

            if (level === "danger") {
                result.alerts.push({
                    level: "danger",
                    title: percent === 100 ? "Budget fully used" : "You are over your monthly budget",
                    text: remaining < 0
                        ? "You have spent " + money(-remaining) + " more than the " + money(budget) + " you planned for this month."
                        : "You have spent all of the " + money(budget) + " planned for this month."
                });
            } else if (level === "warn") {
                result.alerts.push({
                    level: "warn",
                    title: "You have used " + Math.floor(percent) + "% of your budget",
                    text: "Only " + money(remaining) + " is left for the rest of the month (" + plural(daysLeftInMonth, "day") + " to go)."
                });
            }

            // Budget runway: pace this month so far (or the 30-day pace if nothing spent yet this month).
            if (remaining > 0) {
                var monthPace = monthSpent > 0 ? monthSpent / Math.max(1, now.getDate()) : dailyPace;
                if (monthPace > 0) {
                    var daysLeft = Math.floor(remaining / monthPace);
                    b.daysUntilEmpty = daysLeft;
                    b.runsOutOn = addDays(now, daysLeft);
                    b.lastsToMonthEnd = daysLeft >= daysLeftInMonth;

                    if (!b.lastsToMonthEnd && level !== "danger") {
                        result.alerts.push({
                            level: level === "warn" ? "warn" : "info",
                            title: "Budget may run out early",
                            text: "At about " + money(monthPace) + " a day, your budget runs out around " + niceDate(b.runsOutOn) +
                                  ", " + plural(daysLeftInMonth - daysLeft, "day") + " before the month ends."
                        });
                    }
                }
            }
            result.budget = b;
        }

        // ---- Balance runway ----
        if (balance > 0 && dailyPace > 0) {
            var d = Math.floor(balance / dailyPace);
            result.balanceRunway = { days: d, date: addDays(now, d), pace: dailyPace };
        } else if (balance <= 0 && expense > 0) {
            result.alerts.push({
                level: "danger",
                title: "Your balance is " + (balance === 0 ? "zero" : "negative"),
                text: balance === 0 ? "You have spent everything you recorded as income." : "You have spent " + money(-balance) + " more than you recorded as income."
            });
        }

        return result;
    }

    // ------------------------------------------------------------------ rendering

    var STYLES = {
        danger: { box: "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200", icon: "fa-circle-exclamation text-red-500" },
        warn:   { box: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200", icon: "fa-triangle-exclamation text-amber-500" },
        info:   { box: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200", icon: "fa-circle-info text-sky-500" },
        ok:     { box: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200", icon: "fa-circle-check text-emerald-500" }
    };

    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    function alertBox(a) {
        var s = STYLES[a.level] || STYLES.info;
        return '<div class="flex gap-3 rounded-xl border p-4 ' + s.box + '" role="alert">' +
               '<i class="fa-solid ' + s.icon + ' mt-0.5"></i>' +
               '<div><p class="font-semibold">' + esc(a.title) + '</p><p class="text-sm mt-0.5">' + esc(a.text) + '</p></div></div>';
    }

    function runwayCard(r) {
        var lines = [];

        if (r.balanceRunway) {
            lines.push('<p class="text-sm text-slate-600 dark:text-slate-300">At your recent pace of <strong>' + money(r.balanceRunway.pace) +
                       ' a day</strong>, your balance of <strong>' + money(r.balance) + '</strong> lasts about <strong>' +
                       plural(r.balanceRunway.days, "day") + '</strong>, until <strong>' + niceDate(r.balanceRunway.date) + '</strong>.</p>');
        }
        // The "runs out early" case already has its own alert above, so only the good news is repeated here.
        if (r.budget && r.budget.lastsToMonthEnd === true) {
            lines.push('<p class="text-sm text-slate-600 dark:text-slate-300 mt-1">Your monthly budget should <strong>last to the end of the month</strong>.</p>');
        }
        if (!lines.length) return "";

        return '<div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">' +
               '<p class="font-semibold text-slate-900 dark:text-slate-100 mb-1"><i class="fa-solid fa-hourglass-half text-green mr-2"></i>Money lasts until</p>' +
               lines.join("") + '</div>';
    }

    function render(container, r) {
        if (!container) return;
        var html = r.alerts.map(alertBox).join("");

        if (!r.alerts.length && r.budget && r.budget.level === "ok") {
            html += alertBox({ level: "ok", title: "You are within your budget", text: "You have used " + Math.floor(r.budget.percent) + "% of " + money(r.budget.amount) + " this month." });
        }
        html += runwayCard(r);

        if (!html) {
            html = '<p class="text-sm text-slate-500 dark:text-slate-400">Add some expenses and set a monthly budget to see spending alerts and an estimate of how long your money lasts.</p>';
        }
        container.innerHTML = '<div class="space-y-3">' + html + '</div>';
    }

    // ------------------------------------------------------------------ browser wiring

    var API = "http://localhost:5000/api";

    function authHeaders() {
        var token = null;
        try { token = localStorage.getItem("cashbookToken"); } catch (e) { /* ignore */ }
        return token ? { "Authorization": "Bearer " + token } : null;
    }

    async function refresh() {
        var container = document.getElementById("insights-panel");
        var headers = authHeaders();
        if (!container || !headers) return;

        try {
            var results = await Promise.all([
                fetch(API + "/transactions", { headers: headers }),
                fetch(API + "/budget", { headers: headers })
            ]);
            if (!results[0].ok) return;

            var tx = (await results[0].json()).transactions || [];
            var budgetAmount = 0;
            if (results[1].ok) {
                var b = await results[1].json();
                budgetAmount = (b.budget && b.budget.amount) || 0;
            }
            render(container, compute(tx, budgetAmount, new Date()));
        } catch (error) {
            console.error("Insights could not be loaded:", error);
        }
    }

    var api = { compute: compute, render: render, refresh: refresh };

    if (typeof module !== "undefined" && module.exports) module.exports = api;
    root.CashBookInsights = api;

    if (typeof document !== "undefined") {
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh);
        else refresh();
    }
})(typeof window !== "undefined" ? window : this);
