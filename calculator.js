// =====================================================
// Calculator for the Add / Edit Transaction form.
// Click the calculator icon in the Amount box, work out the sum
// (for example 2500 + 1200 x 3), then press "Use this amount".
//
// The calculation is read by a small parser below. It does NOT use
// eval(), so nothing typed here can run as code.
// =====================================================
(function () {
    "use strict";

    // ---------- parser ----------
    // Grammar:  expr   = term (("+" | "-") term)*
    //           term   = unary (("*" | "/") unary)*
    //           unary  = "-" unary | "+" unary | atom
    //           atom   = (number | "(" expr ")") "%"*
    function tokenize(text) {
        const tokens = [];
        let i = 0;

        while (i < text.length) {
            const ch = text[i];

            if (/\s/.test(ch) || ch === ",") { i++; continue; }

            if (/[0-9.]/.test(ch)) {
                let j = i;
                while (j < text.length && /[0-9.,]/.test(text[j])) j++;
                const raw = text.slice(i, j).replace(/,/g, "");

                if (!/^(\d+\.?\d*|\.\d+)$/.test(raw)) {
                    throw new Error("Invalid number");
                }

                tokens.push({ t: "num", v: parseFloat(raw) });
                i = j;
                continue;
            }

            if ("+-*/()%".indexOf(ch) > -1) { tokens.push({ t: ch }); i++; continue; }
            if (ch === "×" || ch === "x" || ch === "X") { tokens.push({ t: "*" }); i++; continue; }
            if (ch === "÷") { tokens.push({ t: "/" }); i++; continue; }
            if (ch === "−" || ch === "–") { tokens.push({ t: "-" }); i++; continue; }

            throw new Error("Unexpected character");
        }

        return tokens;
    }

    function evaluate(text) {
        const tokens = tokenize(text);
        let pos = 0;

        const peek = () => (pos < tokens.length ? tokens[pos].t : null);

        function expr() {
            let value = term();

            while (peek() === "+" || peek() === "-") {
                const op = tokens[pos++].t;
                const right = term();
                value = op === "+" ? value + right : value - right;
            }

            return value;
        }

        function term() {
            let value = unary();

            while (peek() === "*" || peek() === "/") {
                const op = tokens[pos++].t;
                const right = unary();

                if (op === "/") {
                    if (right === 0) throw new Error("Cannot divide by zero");
                    value = value / right;
                } else {
                    value = value * right;
                }
            }

            return value;
        }

        function unary() {
            if (peek() === "-") { pos++; return -unary(); }
            if (peek() === "+") { pos++; return unary(); }
            return atom();
        }

        function atom() {
            let value;

            if (peek() === "num") {
                value = tokens[pos++].v;
            } else if (peek() === "(") {
                pos++;
                value = expr();
                if (peek() !== ")") throw new Error("Missing closing bracket");
                pos++;
            } else {
                throw new Error("Incomplete");
            }

            while (peek() === "%") { pos++; value = value / 100; }

            return value;
        }

        if (!tokens.length) throw new Error("Empty");

        const result = expr();

        if (pos < tokens.length) throw new Error("Unexpected input");
        if (!isFinite(result)) throw new Error("Number too large");

        return result;
    }

    // Round to 2 decimals (kobo) and hide floating point noise (0.1 + 0.2)
    function toMoney(n) {
        return Math.round((n + Number.EPSILON) * 100) / 100;
    }

    function pretty(n) {
        return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 }).format(n);
    }

    // Make the tests able to use the parser
    window.cashbookCalc = { evaluate: evaluate, toMoney: toMoney };

    // ---------- page wiring ----------
    document.addEventListener("DOMContentLoaded", function () {
        const toggle = document.getElementById("calc-toggle");
        const panel = document.getElementById("calc-panel");
        const display = document.getElementById("calc-display");
        const resultLine = document.getElementById("calc-result");
        const useButton = document.getElementById("calc-use");
        const amountInput = document.getElementById("amount");
        const modal = document.getElementById("transactionModal");

        if (!toggle || !panel || !display || !amountInput) return;

        let current = null;   // the latest valid result (or null)

        function refresh() {
            const text = display.value.trim();
            current = null;
            useButton.disabled = true;
            resultLine.className = "text-right text-sm text-slate-500 dark:text-slate-400 h-6 mt-1";

            if (!text) { resultLine.textContent = ""; return; }

            try {
                const value = toMoney(evaluate(text));

                if (Math.abs(value) > 999999999999) {
                    throw new Error("Number too large");
                }

                if (!(value > 0)) {
                    resultLine.textContent = "= " + pretty(value) + "  (amount must be more than 0)";
                    return;
                }

                current = value;
                resultLine.textContent = "= ₦" + pretty(value);
                resultLine.className = "text-right text-sm text-green font-semibold h-6 mt-1";
                useButton.disabled = false;

            } catch (error) {
                // While typing, "2500 +" is just unfinished, not an error worth shouting about
                const unfinished = /Incomplete|Empty|Unexpected input|Missing closing/.test(error.message);
                resultLine.textContent = unfinished ? "" : error.message;

                if (!unfinished) resultLine.className = "text-right text-sm text-red-500 h-6 mt-1";
            }
        }

        function setPanel(open) {
            panel.classList.toggle("hidden", !open);
            toggle.setAttribute("aria-expanded", open ? "true" : "false");

            if (open) {
                // Start from the amount already typed in the form, if any
                if (!display.value && amountInput.value) display.value = amountInput.value;
                refresh();
                display.focus();
            }
        }

        function press(key) {
            if (key === "clear") { display.value = ""; }
            else if (key === "back") { display.value = display.value.slice(0, -1); }
            else if (key === "equals") {
                if (current !== null) display.value = String(current);
            }
            else { display.value += key; }

            refresh();
            display.focus();
        }

        toggle.addEventListener("click", function () {
            setPanel(panel.classList.contains("hidden"));
        });

        panel.querySelectorAll("[data-calc]").forEach(function (button) {
            button.addEventListener("click", function () {
                press(button.dataset.calc);
            });
        });

        // Typing on a real keyboard
        display.addEventListener("input", function () {
            // keep only characters the calculator understands
            display.value = display.value.replace(/[^0-9.,+\-*/()%×÷−xX\s]/g, "");
            refresh();
        });

        display.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();               // do not submit the form
                if (current !== null) { display.value = String(current); refresh(); }
            }

            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();              // close the calculator, not the whole form
                setPanel(false);
                toggle.focus();
            }
        });

        useButton.addEventListener("click", function () {
            if (current === null) return;

            amountInput.value = String(current);
            amountInput.dispatchEvent(new Event("input", { bubbles: true }));
            amountInput.dispatchEvent(new Event("change", { bubbles: true }));

            setPanel(false);
            amountInput.focus();
        });

        // Every time the form opens or closes, start with a closed, empty calculator
        if (modal && "MutationObserver" in window) {
            new MutationObserver(function () {
                display.value = "";
                resultLine.textContent = "";
                current = null;
                useButton.disabled = true;
                panel.classList.add("hidden");
                toggle.setAttribute("aria-expanded", "false");
            }).observe(modal, { attributes: true, attributeFilter: ["open"] });
        }
    });
})();
