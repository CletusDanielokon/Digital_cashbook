// lock.js - optional PIN lock for CashBook.
//
// When a PIN is set (Settings > Security > App lock), CashBook asks for it:
//   - when the app is opened in a new tab or window,
//   - and when you come back to it after being away for a minute.
// Signing in with your password never asks for the PIN straight afterwards.
//
// The PIN is kept only on this device (as a salted hash, never the PIN itself).
// It protects the app on this device. It does not replace your password.
//
// Load this file in the <head> WITHOUT "defer", so the page can be hidden before
// anything is painted on screen.
(function () {
    "use strict";

    var AWAY_MS = 60 * 1000;          // locks again after this long away from the page
    var MAX_TRIES = 5;                 // wrong PINs before a short wait
    var WAIT_SECONDS = 30;

    // ---------------------------------------------------------
    // Who is signed in?
    // ---------------------------------------------------------
    var token = null, user = null;
    try {
        token = localStorage.getItem("cashbookToken");
        user = JSON.parse(localStorage.getItem("cashbookUser"));
    } catch (e) { /* ignore */ }

    if (!token || !user) return;     // not signed in: nothing to lock

    var uid = String(user._id || user.id || user.email || user.mobile || "user");
    var PIN_KEY = "cashbookPin:" + uid;
    var UNLOCK_KEY = "cashbookUnlocked";

    function readPin() {
        try { return JSON.parse(localStorage.getItem(PIN_KEY)); } catch (e) { return null; }
    }

    function isUnlocked() {
        try { return sessionStorage.getItem(UNLOCK_KEY) === "1"; } catch (e) { return true; }
    }

    function setUnlocked(value) {
        try { sessionStorage.setItem(UNLOCK_KEY, value ? "1" : "0"); } catch (e) { /* ignore */ }
    }

    // A new sign-in (different token) counts as unlocked: the password was just typed
    try {
        if (localStorage.getItem("cashbookLockToken") !== token) {
            localStorage.setItem("cashbookLockToken", token);
            setUnlocked(true);
        }
    } catch (e) { /* ignore */ }

    // ---------------------------------------------------------
    // Hashing (needs a secure page: https or localhost)
    // ---------------------------------------------------------
    function canHash() {
        return !!(window.crypto && window.crypto.subtle && window.TextEncoder);
    }

    function newSalt() {
        var bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        return Array.prototype.map.call(bytes, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    }

    function hashPin(pin, salt) {
        return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pin)).then(function (buffer) {
            return Array.prototype.map.call(new Uint8Array(buffer), function (b) {
                return ("0" + b.toString(16)).slice(-2);
            }).join("");
        });
    }

    function checkPin(pin) {
        var record = readPin();
        if (!record || !canHash()) return Promise.resolve(false);
        return hashPin(pin, record.s).then(function (hash) { return hash === record.h; });
    }

    // ---------------------------------------------------------
    // Look of the lock screen
    // ---------------------------------------------------------
    var style = document.createElement("style");
    style.id = "cbl-style";
    style.textContent = [
        "html.cbl-locked body{visibility:hidden}",
        "#cbl-overlay{position:fixed;inset:0;z-index:2147483000;visibility:visible;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;background:#f8fafc;color:#0f172a;font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;text-align:center}",
        "html.dark #cbl-overlay{background:#0f172a;color:#f1f5f9}",
        "#cbl-overlay .cbl-box{width:100%;max-width:340px}",
        "#cbl-overlay .cbl-logo{width:64px;height:64px;margin:0 auto 18px;display:block}",
        "#cbl-overlay h1{font-size:22px;margin:0 0 6px}",
        "#cbl-overlay p{margin:0 0 20px;font-size:14px;line-height:1.5;color:#475569}",
        "html.dark #cbl-overlay p{color:#94a3b8}",
        "#cbl-overlay input{width:100%;box-sizing:border-box;height:52px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;color:#0f172a;text-align:center;font-size:24px;letter-spacing:8px;margin-bottom:12px}",
        "html.dark #cbl-overlay input{background:#1e293b;border-color:#334155;color:#f1f5f9}",
        "#cbl-overlay input:focus{outline:3px solid rgba(34,197,94,.45);outline-offset:1px;border-color:#22c55e}",
        "#cbl-overlay button.cbl-go{width:100%;height:46px;border:0;border-radius:10px;background:#22c55e;color:#fff;font:inherit;font-weight:600;cursor:pointer}",
        "#cbl-overlay button.cbl-go:hover{background:#16a34a}",
        "#cbl-overlay button.cbl-go:disabled{opacity:.55;cursor:not-allowed}",
        "#cbl-overlay button.cbl-link{margin-top:16px;border:0;background:none;font:inherit;font-size:13px;color:#64748b;cursor:pointer;text-decoration:underline}",
        "#cbl-overlay .cbl-error{min-height:20px;margin:0 0 10px;font-size:13px;color:#ef4444}"
    ].join("\n");
    document.head.appendChild(style);

    // ---------------------------------------------------------
    // Showing and removing the lock screen
    // ---------------------------------------------------------
    var overlay = null;
    var tries = 0;
    var waitTimer = null;

    function setSiblingsInert(on) {
        if (!document.body) return;
        Array.prototype.forEach.call(document.body.children, function (child) {
            if (child === overlay) return;
            if (on) child.setAttribute("inert", "");
            else child.removeAttribute("inert");
        });
    }

    function logoutForgotten() {
        if (!window.confirm("Log out and remove the PIN from this device? You can sign in again with your password.")) return;
        try {
            localStorage.removeItem(PIN_KEY);
            localStorage.removeItem("cashbookLockToken");
            localStorage.removeItem("cashbookToken");
            localStorage.removeItem("cashbookUser");
            sessionStorage.removeItem(UNLOCK_KEY);
        } catch (e) { /* ignore */ }
        window.location.href = "index.html";
    }

    function unlock() {
        setUnlocked(true);
        tries = 0;
        if (waitTimer) { clearInterval(waitTimer); waitTimer = null; }
        document.documentElement.classList.remove("cbl-locked");
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        overlay = null;
        setSiblingsInert(false);
    }

    function buildOverlay() {
        overlay = document.createElement("div");
        overlay.id = "cbl-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", "cbl-title");

        var firstName = String(user.fullName || user.name || "").trim().split(/\s+/)[0];

        overlay.innerHTML =
            '<form class="cbl-box" autocomplete="off">' +
            '<svg class="cbl-logo" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#22c55e"/><path d="M16 22a6 6 0 0 1 6-6h24a4 4 0 0 1 4 4v4H22a2 2 0 0 0 0 4h28a2 2 0 0 1 2 2v14a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6V22z" fill="#fff"/><circle cx="44" cy="38" r="3" fill="#22c55e"/></svg>' +
            '<h1 id="cbl-title">CashBook is locked</h1>' +
            '<p></p>' +
            '<input id="cbl-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" aria-label="Your PIN">' +
            '<p class="cbl-error" id="cbl-error" role="alert"></p>' +
            '<button type="submit" class="cbl-go">Unlock</button>' +
            '<button type="button" class="cbl-link" id="cbl-forgot">Forgot PIN? Log out</button>' +
            '</form>';

        overlay.querySelector("p").textContent = firstName ? "Enter your PIN to continue, " + firstName + "." : "Enter your PIN to continue.";

        document.body.appendChild(overlay);
        setSiblingsInert(true);

        var form = overlay.querySelector("form");
        var input = overlay.querySelector("#cbl-pin");
        var error = overlay.querySelector("#cbl-error");
        var button = overlay.querySelector(".cbl-go");

        overlay.querySelector("#cbl-forgot").addEventListener("click", logoutForgotten);

        form.addEventListener("submit", function (event) {
            event.preventDefault();
            if (button.disabled) return;

            var pin = input.value.trim();
            if (!/^\d{4,6}$/.test(pin)) {
                error.textContent = "Enter your 4 to 6 digit PIN.";
                return;
            }

            checkPin(pin).then(function (ok) {
                if (ok) { unlock(); return; }

                tries++;
                input.value = "";
                if (tries >= MAX_TRIES) {
                    tries = 0;
                    var left = WAIT_SECONDS;
                    button.disabled = true;
                    input.disabled = true;
                    error.textContent = "Too many tries. Wait " + left + " seconds.";
                    waitTimer = setInterval(function () {
                        left--;
                        if (left <= 0) {
                            clearInterval(waitTimer);
                            waitTimer = null;
                            button.disabled = false;
                            input.disabled = false;
                            error.textContent = "";
                            input.focus();
                        } else {
                            error.textContent = "Too many tries. Wait " + left + " seconds.";
                        }
                    }, 1000);
                } else {
                    error.textContent = "Wrong PIN. " + (MAX_TRIES - tries) + (MAX_TRIES - tries === 1 ? " try left." : " tries left.");
                }
            });
        });

        input.focus();
    }

    function showLock() {
        if (overlay) return;
        document.documentElement.classList.add("cbl-locked");
        if (document.body) buildOverlay();
        else document.addEventListener("DOMContentLoaded", buildOverlay);
    }

    function lockNow() {
        if (!readPin() || !canHash()) return;
        setUnlocked(false);
        showLock();
    }

    // Locked from the start?
    if (readPin() && canHash() && !isUnlocked()) showLock();

    // Lock again after being away from the page
    var hiddenAt = 0;
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
            hiddenAt = Date.now();
        } else if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) {
            hiddenAt = 0;
            lockNow();
        }
    });

    // ---------------------------------------------------------
    // Settings page: set, change and turn off the PIN
    // ---------------------------------------------------------
    function wireSettings() {
        var section = document.getElementById("applock-section");
        if (!section) return;

        var status = document.getElementById("applock-status");
        var mainButton = document.getElementById("applock-main");
        var changeButton = document.getElementById("applock-change");
        var modal = document.getElementById("applock-modal");
        var form = document.getElementById("applock-form");
        var title = document.getElementById("applock-title");
        var message = document.getElementById("applock-message");
        var currentWrap = document.getElementById("applock-current-wrap");
        var newWrap = document.getElementById("applock-new-wrap");
        var currentInput = document.getElementById("applock-current");
        var newInput = document.getElementById("applock-new");
        var confirmInput = document.getElementById("applock-confirm");
        var saveButton = document.getElementById("applock-save");
        var mode = "set";

        function refresh() {
            var on = !!readPin();
            if (!canHash()) {
                status.textContent = "App lock needs a secure (https) connection and is not available here.";
                mainButton.disabled = true;
                mainButton.classList.add("opacity-50");
                return;
            }
            status.textContent = on
                ? "On. CashBook asks for your PIN when it is opened, or after you have been away for a minute."
                : "Ask for a PIN when CashBook is opened on this device.";
            mainButton.textContent = on ? "Turn off" : "Set up";
            changeButton.classList.toggle("hidden", !on);
        }

        function say(text, bad) {
            message.textContent = text;
            message.className = "text-sm " + (bad ? "text-red-500" : "text-slate-500 dark:text-slate-400");
        }

        function open(nextMode) {
            mode = nextMode;
            form.reset();
            var on = mode !== "set";
            currentWrap.classList.toggle("hidden", !on);
            newWrap.classList.toggle("hidden", mode === "off");
            title.textContent = mode === "set" ? "Set up PIN" : mode === "change" ? "Change PIN" : "Turn off PIN";
            saveButton.textContent = mode === "off" ? "Turn off" : "Save PIN";
            say(mode === "off"
                ? "Enter your current PIN to turn the lock off."
                : "Choose 4 to 6 digits. The PIN stays on this device only and does not replace your password.");
            modal.classList.remove("hidden");
            modal.classList.add("flex");
            (on ? currentInput : newInput).focus();
        }

        function close() {
            modal.classList.add("hidden");
            modal.classList.remove("flex");
            form.reset();
        }

        mainButton.addEventListener("click", function () { open(readPin() ? "off" : "set"); });
        changeButton.addEventListener("click", function () { open("change"); });
        document.querySelectorAll("[data-applock-close]").forEach(function (el) { el.addEventListener("click", close); });
        modal.addEventListener("click", function (event) { if (event.target === modal) close(); });
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && !modal.classList.contains("hidden")) close();
        });

        form.addEventListener("submit", function (event) {
            event.preventDefault();

            var current = currentInput.value.trim();
            var fresh = newInput.value.trim();
            var again = confirmInput.value.trim();

            function saveNew() {
                if (!/^\d{4,6}$/.test(fresh)) return say("The PIN must be 4 to 6 digits.", true);
                if (fresh !== again) return say("The two PINs do not match.", true);

                var salt = newSalt();
                hashPin(fresh, salt).then(function (hash) {
                    try { localStorage.setItem(PIN_KEY, JSON.stringify({ s: salt, h: hash })); } catch (e) {
                        return say("This browser would not save the PIN.", true);
                    }
                    setUnlocked(true);
                    close();
                    refresh();
                });
            }

            if (mode === "set") return saveNew();

            checkPin(current).then(function (ok) {
                if (!ok) return say("That is not your current PIN.", true);
                if (mode === "change") return saveNew();

                try { localStorage.removeItem(PIN_KEY); } catch (e) { /* ignore */ }
                close();
                refresh();
            });
        });

        refresh();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wireSettings);
    else wireSettings();

    window.CashbookLock = { lockNow: lockNow };
})();
