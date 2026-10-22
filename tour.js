// tour.js
// A short guided tour for new users. It dims the page, highlights each tab in
// the sidebar, points an arrow at it and explains what it is for.
//
// - Starts by itself ONCE per user, on the welcome page they see after signing in.
// - Can be skipped any time (Skip button, Esc key or clicking Finish).
// - A "Take a tour" button is added to the sidebar of every page so it can be replayed.
// - Works on phones: the side menu is opened for the tour and closed afterwards.
(function () {
    "use strict";

    if (window.__cashbookTour) return;
    window.__cashbookTour = true;

    // ---------------------------------------------------------
    // The steps. Edit the words here. "tab" must match the tab's label.
    // A step with no "tab" is shown in the middle of the screen.
    // ---------------------------------------------------------
    var STEPS = [
        {
            icon: "fa-wallet",
            title: "Welcome to CashBook!",
            text: "Here is a quick tour of what each tab is for. It takes about a minute, and you can skip it at any time."
        },
        {
            tab: "Dashboard",
            icon: "fa-house",
            title: "Dashboard",
            text: "Your money at a glance: income, expenses, balance, budget progress and debts. Use \"Hide balances\" to blur the amounts when others are watching."
        },
        {
            tab: "Transactions",
            icon: "fa-arrow-right-arrow-left",
            title: "Transactions",
            text: "Record every naira that comes in or goes out. Search and filter your history, paste a bank alert, or scan a receipt or teller with your camera and CashBook fills in the details for you."
        },
        {
            tab: "Budget & Goals",
            icon: "fa-bullseye",
            title: "Budget & Goals",
            text: "Set a monthly spending budget so you know when you are getting close to it, and create savings goals to work towards."
        },
        {
            tab: "Debts",
            icon: "fa-hand-holding-dollar",
            title: "Debts",
            text: "Keep track of money people owe you and money you owe: loans, services, bills or rent. Add notes, record part-payments, see what is overdue and send a WhatsApp reminder."
        },
        {
            tab: "Reports",
            icon: "fa-chart-pie",
            title: "Reports",
            text: "See charts of your income, expenses and spending by category, and download your records as PDF or Excel."
        },
        {
            tab: "Profile",
            icon: "fa-user",
            title: "Profile",
            text: "Your personal details and the name of your CashBook."
        },
        {
            tab: "Settings",
            icon: "fa-gear",
            title: "Settings",
            text: "Switch dark mode, edit your details, change your password, set an app-lock PIN, verify your email or phone, and manage your data."
        },
        {
            icon: "fa-circle-check",
            title: "You are all set!",
            text: "The best way to start is by adding your first transaction. You can replay this tour any time with \"Take a tour\" in the side menu.",
            final: true
        }
    ];

    var DESKTOP_MIN = 1024;       // same breakpoint the pages use for the sidebar
    var current = 0;
    var running = false;
    var openedMenu = false;
    var lastFocus = null;
    var els = {};

    // ---------------------------------------------------------
    // Remember who has seen the tour
    // ---------------------------------------------------------
    function readUser() {
        try { return JSON.parse(localStorage.getItem("cashbookUser")) || {}; } catch (e) { return {}; }
    }

    function seenKey() {
        var u = readUser();
        return "cashbookTourSeen:" + (u._id || u.id || u.email || u.mobile || "user");
    }

    function hasSeen() {
        try { return localStorage.getItem(seenKey()) === "1"; } catch (e) { return false; }
    }

    function markSeen() {
        try { localStorage.setItem(seenKey(), "1"); } catch (e) { /* private mode: ignore */ }
    }

    // ---------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------
    function isDesktop() { return window.innerWidth >= DESKTOP_MIN; }

    function normalise(text) { return String(text || "").replace(/\s+/g, " ").trim().toLowerCase(); }

    function findTab(label) {
        var buttons = document.querySelectorAll("#sidebar nav button");
        var want = normalise(label);
        for (var i = 0; i < buttons.length; i++) {
            var span = buttons[i].querySelector("span");
            if (span && normalise(span.textContent) === want) return buttons[i];
        }
        return null;
    }

    function make(tag, className, text) {
        var el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }

    function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

    function wait(ms, fn) { return setTimeout(fn, ms); }

    // ---------------------------------------------------------
    // Styles (plain CSS so it does not depend on Tailwind)
    // ---------------------------------------------------------
    function addStyles() {
        if (document.getElementById("cbt-style")) return;
        var css = [
            ".cbt-blocker{position:fixed;inset:0;z-index:9990;background:transparent}",
            ".cbt-blocker.cbt-dim{background:rgba(8,15,32,.72)}",
            ".cbt-spot{position:fixed;z-index:9991;border-radius:12px;pointer-events:none;box-shadow:0 0 0 9999px rgba(8,15,32,.72),0 0 0 3px #22c55e;transition:top .25s ease,left .25s ease,width .25s ease,height .25s ease}",
            ".cbt-tip{position:fixed;z-index:9992;width:330px;max-width:calc(100vw - 24px);box-sizing:border-box;padding:18px 18px 16px;border-radius:14px;background:#fff;color:#0f172a;border:1px solid #e2e8f0;box-shadow:0 20px 45px rgba(2,6,23,.35);font-family:Inter,system-ui,sans-serif;font-size:14px;line-height:1.5}",
            ".cbt-tip.cbt-dark{background:#1e293b;color:#f1f5f9;border-color:#334155}",
            ".cbt-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}",
            ".cbt-icon{flex:none;width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:rgba(34,197,94,.14);color:#22c55e;font-size:15px}",
            ".cbt-title{margin:0;font-size:16px;font-weight:700;line-height:1.25}",
            ".cbt-count{margin:0 0 0 auto;flex:none;font-size:11px;font-weight:600;color:#64748b}",
            ".cbt-dark .cbt-count{color:#94a3b8}",
            ".cbt-text{margin:0 0 14px;color:#475569}",
            ".cbt-dark .cbt-text{color:#cbd5e1}",
            ".cbt-dots{display:flex;gap:5px;margin-bottom:14px}",
            ".cbt-dot{height:5px;flex:1;border-radius:99px;background:#e2e8f0}",
            ".cbt-dark .cbt-dot{background:#334155}",
            ".cbt-dot.cbt-on{background:#22c55e}",
            ".cbt-actions{display:flex;align-items:center;gap:8px}",
            ".cbt-btn{font:inherit;font-weight:600;font-size:13px;height:38px;padding:0 14px;border-radius:9px;cursor:pointer;border:1px solid #cbd5e1;background:transparent;color:inherit}",
            ".cbt-btn:hover{background:rgba(100,116,139,.12)}",
            ".cbt-btn:focus-visible{outline:3px solid rgba(34,197,94,.45);outline-offset:1px}",
            ".cbt-primary{background:#22c55e;border-color:#22c55e;color:#fff;margin-left:auto}",
            ".cbt-primary:hover{background:#16a34a}",
            ".cbt-skip{border-color:transparent;color:#64748b;padding:0 6px}",
            ".cbt-dark .cbt-skip{color:#94a3b8}",
            ".cbt-arrow{position:absolute;width:16px;height:16px;background:inherit;border:1px solid #e2e8f0;transform:rotate(45deg)}",
            ".cbt-dark .cbt-arrow{border-color:#334155}",
            ".cbt-arrow.cbt-left{left:-9px;border-right:0;border-top:0}",
            ".cbt-arrow.cbt-up{top:-9px;border-right:0;border-bottom:0}",
            ".cbt-arrow.cbt-down{bottom:-9px;border-left:0;border-top:0}",
            ".cbt-center{left:50%;top:50%;transform:translate(-50%,-50%)}",
            "@media (prefers-reduced-motion:reduce){.cbt-spot{transition:none}}"
        ].join("\n");
        var style = document.createElement("style");
        style.id = "cbt-style";
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ---------------------------------------------------------
    // Build and remove the tour screen
    // ---------------------------------------------------------
    function build() {
        addStyles();

        els.blocker = make("div", "cbt-blocker");
        els.spot = make("div", "cbt-spot");
        els.tip = make("div", "cbt-tip");
        els.tip.setAttribute("role", "dialog");
        els.tip.setAttribute("aria-modal", "true");
        els.tip.setAttribute("aria-labelledby", "cbt-title");
        els.tip.setAttribute("aria-describedby", "cbt-text");

        els.arrow = make("div", "cbt-arrow");
        els.icon = make("div", "cbt-icon");
        els.iconI = make("i", "fa-solid");
        els.icon.appendChild(els.iconI);
        els.title = make("h2", "cbt-title");
        els.title.id = "cbt-title";
        els.count = make("p", "cbt-count");
        els.text = make("p", "cbt-text");
        els.text.id = "cbt-text";
        els.dots = make("div", "cbt-dots");
        els.dots.setAttribute("aria-hidden", "true");

        els.skip = make("button", "cbt-btn cbt-skip", "Skip tour");
        els.skip.type = "button";
        els.back = make("button", "cbt-btn", "Back");
        els.back.type = "button";
        els.next = make("button", "cbt-btn cbt-primary", "Next");
        els.next.type = "button";

        var head = make("div", "cbt-head");
        head.appendChild(els.icon);
        head.appendChild(els.title);
        head.appendChild(els.count);

        var actions = make("div", "cbt-actions");
        actions.appendChild(els.skip);
        actions.appendChild(els.back);
        actions.appendChild(els.next);

        els.tip.appendChild(els.arrow);
        els.tip.appendChild(head);
        els.tip.appendChild(els.text);
        els.tip.appendChild(els.dots);
        els.tip.appendChild(actions);

        for (var i = 0; i < STEPS.length; i++) els.dots.appendChild(make("span", "cbt-dot"));

        document.body.appendChild(els.blocker);
        document.body.appendChild(els.spot);
        document.body.appendChild(els.tip);

        els.skip.addEventListener("click", function () { end(false); });
        els.back.addEventListener("click", function () { go(current - 1); });
        els.next.addEventListener("click", function () {
            if (current < STEPS.length - 1) go(current + 1);
            else end(true, "transactions.html");
        });
    }

    function destroy() {
        ["blocker", "spot", "tip"].forEach(function (k) {
            if (els[k] && els[k].parentNode) els[k].parentNode.removeChild(els[k]);
        });
        els = {};
    }

    // ---------------------------------------------------------
    // Show one step
    // ---------------------------------------------------------
    function place(step, target) {
        var tip = els.tip;
        var vw = window.innerWidth, vh = window.innerHeight;

        // Middle-of-screen step (welcome / finish)
        if (!target) {
            els.spot.style.display = "none";
            els.blocker.classList.add("cbt-dim");
            els.arrow.style.display = "none";
            tip.classList.add("cbt-center");
            tip.style.left = ""; tip.style.top = "";
            return;
        }

        els.blocker.classList.remove("cbt-dim");
        els.arrow.style.display = "";
        tip.classList.remove("cbt-center");

        var r = target.getBoundingClientRect();
        var pad = 4;
        els.spot.style.display = "block";
        els.spot.style.left = (r.left - pad) + "px";
        els.spot.style.top = (r.top - pad) + "px";
        els.spot.style.width = (r.width + pad * 2) + "px";
        els.spot.style.height = (r.height + pad * 2) + "px";

        var tw = tip.offsetWidth, th = tip.offsetHeight;
        els.arrow.className = "cbt-arrow";

        if (isDesktop()) {
            // Tip to the right of the tab, arrow pointing left at it
            var left = r.right + 20;
            var top = clamp(r.top + r.height / 2 - th / 2, 12, Math.max(12, vh - th - 12));
            tip.style.left = left + "px";
            tip.style.top = top + "px";
            els.arrow.classList.add("cbt-left");
            els.arrow.style.left = "";
            els.arrow.style.top = clamp(r.top + r.height / 2 - top - 8, 14, th - 30) + "px";
            els.arrow.style.bottom = "";
        } else {
            // Phone: tip above or below the tab, arrow pointing at it
            var below = (r.top + r.height / 2) < vh / 2;
            var tipLeft = clamp((vw - tw) / 2, 12, Math.max(12, vw - tw - 12));
            var tipTop = below ? Math.min(r.bottom + 20, vh - th - 12) : Math.max(12, r.top - th - 20);
            tip.style.left = tipLeft + "px";
            tip.style.top = tipTop + "px";
            els.arrow.classList.add(below ? "cbt-up" : "cbt-down");
            els.arrow.style.top = "";
            els.arrow.style.bottom = "";
            els.arrow.style.left = clamp(r.left + r.width / 2 - tipLeft - 8, 16, tw - 32) + "px";
        }
    }

    function show() {
        var step = STEPS[current];
        var target = step.tab ? findTab(step.tab) : null;

        els.tip.classList.toggle("cbt-dark", document.documentElement.classList.contains("dark"));
        els.iconI.className = "fa-solid " + step.icon;
        els.title.textContent = step.title;
        els.text.textContent = step.text;
        els.count.textContent = (current + 1) + " / " + STEPS.length;

        var dots = els.dots.children;
        for (var i = 0; i < dots.length; i++) dots[i].classList.toggle("cbt-on", i <= current);

        els.back.style.display = current === 0 ? "none" : "";
        els.skip.style.display = step.final ? "none" : "";
        els.next.textContent = step.final ? "Add my first transaction" : (current === 0 ? "Start tour" : "Next");

        if (target && target.scrollIntoView) target.scrollIntoView({ block: "nearest" });

        place(step, target);
        els.next.focus();
    }

    function go(index) {
        if (!running) return;
        current = clamp(index, 0, STEPS.length - 1);
        show();
    }

    // ---------------------------------------------------------
    // Start and finish
    // ---------------------------------------------------------
    function onKey(event) {
        if (!running) return;

        if (event.key === "Escape") { event.preventDefault(); end(false); return; }
        if (event.key === "ArrowRight") { event.preventDefault(); if (current < STEPS.length - 1) go(current + 1); return; }
        if (event.key === "ArrowLeft") { event.preventDefault(); if (current > 0) go(current - 1); return; }

        // Keep keyboard focus inside the tour box
        if (event.key === "Tab") {
            var items = Array.prototype.filter.call(els.tip.querySelectorAll("button"), function (b) {
                return b.style.display !== "none";
            });
            if (!items.length) return;
            var first = items[0], last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            else if (items.indexOf(document.activeElement) === -1) { event.preventDefault(); first.focus(); }
        }
    }

    function onResize() { if (running) show(); }

    function start() {
        if (running) return;
        if (!document.getElementById("sidebar")) return;

        running = true;
        current = 0;
        lastFocus = document.activeElement;

        // On phones the menu is hidden off-screen: slide it in for the tour
        var sidebar = document.getElementById("sidebar");
        var overlay = document.getElementById("mobile-overlay");
        openedMenu = false;
        if (!isDesktop() && sidebar.classList.contains("-translate-x-full")) {
            sidebar.classList.remove("-translate-x-full");
            if (overlay) overlay.classList.remove("hidden");
            openedMenu = true;
        }

        build();
        document.addEventListener("keydown", onKey, true);
        window.addEventListener("resize", onResize);

        // Give the menu time to finish sliding in before measuring
        if (openedMenu) {
            els.tip.style.visibility = "hidden";
            wait(350, function () {
                if (!running) return;
                els.tip.style.visibility = "";
                show();
            });
        } else {
            show();
        }
    }

    function end(finished, goToPage) {
        if (!running) return;
        running = false;

        markSeen();
        document.removeEventListener("keydown", onKey, true);
        window.removeEventListener("resize", onResize);
        destroy();

        if (openedMenu) {
            var sidebar = document.getElementById("sidebar");
            var overlay = document.getElementById("mobile-overlay");
            if (sidebar) sidebar.classList.add("-translate-x-full");
            if (overlay) overlay.classList.add("hidden");
            openedMenu = false;
        }

        if (finished && goToPage && window.location.pathname.split("/").pop() !== goToPage) {
            window.location.href = goToPage;
            return;
        }

        if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* ignore */ } }
    }

    // ---------------------------------------------------------
    // "Take a tour" button in the sidebar + automatic first start
    // ---------------------------------------------------------
    function addMenuButton() {
        var nav = document.querySelector("#sidebar nav");
        if (!nav || document.getElementById("tour-link")) return;

        var button = make("button", "menu-link");
        button.id = "tour-link";
        button.type = "button";
        var icon = make("i", "fa-regular fa-circle-question");
        var label = make("span", "", "Take a tour");
        button.appendChild(icon);
        button.appendChild(label);

        button.addEventListener("click", function () {
            // closes the phone menu handler first, then starts the tour
            wait(0, start);
        });

        nav.appendChild(button);
    }

    function init() {
        addMenuButton();

        // Only the page shown right after signing in starts the tour by itself
        var page = window.location.pathname.split("/").pop();
        if (page === "welcome.html" && !hasSeen()) {
            wait(700, start);
        }
    }

    // Let other scripts (or the browser console) start it too: CashbookTour.start()
    window.CashbookTour = { start: start, end: function () { end(false); } };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
