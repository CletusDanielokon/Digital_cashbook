// receipt.js - attach, scan and view transfer tellers and receipts.
//
//   CashbookReceipt.mount(container, { scan: true, onScan: function (found) {...} })
//        puts "Take photo / Upload image" (and, if scan is true, a "Scan and fill" button)
//        inside container and returns a handle.
//   handle.setExisting(id)  show a picture that is already saved (when editing)
//   handle.reset()          clear it (when a form is reopened)
//   handle.prepare()        uploads a newly chosen picture and answers:
//                           { value: undefined }  nothing changed, leave things as they are
//                           { value: null }       the saved picture was removed
//                           { value: "id", uploaded: true }  a new picture was saved
//   CashbookReceipt.discard(id)   deletes a picture that was uploaded but never used
//   CashbookReceipt.view(id)      opens a saved picture full screen
//
// Reading the text of a picture (OCR) happens inside the phone or computer. The picture is
// NOT sent to any scanning service. It is only saved to your CashBook if you save the form.
(function (root) {
    "use strict";

    // =========================================================
    // PART 1: reading the text of a receipt or bank teller
    // (pure functions, no page needed)
    // =========================================================

    var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

    var CATEGORY_WORDS = [
        ["Airtime", /\b(airtime|recharge|top[- ]?up)\b/i],
        ["Data", /\b(data|bundle|mb|gb)\b/i],
        ["Utilities", /\b(electric|electricity|prepaid|ikedc|ekedc|aedc|phed|nepa|dstv|gotv|startimes|water|waste|token)\b/i],
        ["Transport", /\b(uber|bolt|indrive|taxi|fuel|petrol|diesel|filling|total energies|oando|mobil|bus|ride|toll|flight|air peace|ticket)\b/i],
        ["Food", /\b(restaurant|eatery|kitchen|foods?|chicken|pizza|bakery|shoprite|supermarket|mart|grocer|cafe|suya|buka|spar|drinks?)\b/i],
        ["Salary", /\b(salary|wages|payroll)\b/i],
        ["Entertainment", /\b(cinema|movie|netflix|showmax|spotify|game|betting|bet9ja|sportybet|club|lounge)\b/i]
    ];

    // OCR often reads the naira sign as N, #, W, H or a symbol. Make those into "NGN".
    function cleanText(text) {
        return String(text || "")
            .replace(/\r/g, "\n")
            .replace(/[|]/g, "I")
            .replace(/(^|[^A-Za-z0-9])(?:₦|#|₩|\u20A6|NGN|N)\s?(?=\d)/g, "$1NGN ")
            .replace(/[ \t]+/g, " ");
    }

    function toNumber(text) {
        var n = parseFloat(String(text).replace(/,/g, ""));
        return isFinite(n) ? n : 0;
    }

    function pad2(n) { return (n < 10 ? "0" : "") + n; }

    function realDate(y, m, d) {
        if (y < 100) y += 2000;
        var date = new Date(Date.UTC(y, m - 1, d));
        if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return "";
        var thisYear = new Date().getUTCFullYear();
        if (y < 2000 || y > thisYear + 1) return "";
        return y + "-" + pad2(m) + "-" + pad2(d);
    }

    // The amount: prefers numbers beside a naira sign or a word like "total" or "amount"
    function findAmount(text) {
        var lines = text.split("\n");
        var best = null;

        lines.forEach(function (rawLine, index) {
            var line = rawLine.trim();
            if (!line) return;

            // Dates, times and long reference numbers are not amounts: blank them out first
            var scrub = line
                .replace(/\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/g, " ")
                .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
                .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, " ")
                .replace(/\b\d{9,}\b/g, " ");

            var lower = scrub.toLowerCase();
            var labelled = /(^|[^a-z])(grand ?total|total|amount|amt|paid|debit|credit|sum|net|pay|price|cash)([^a-z]|$)/.test(lower) &&
                !/sub ?total/.test(lower.replace(/total/, "total"));
            var isSub = /sub ?total/.test(lower);
            var minor = /(balance|bal\b|fee|charge|vat|tax|stamp|change|tendered|discount|cashback|vatable)/.test(lower);

            var pattern = /(NGN\s?)?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{2}|\d{2,9})/g;
            var match;

            while ((match = pattern.exec(scrub)) !== null) {
                var value = toNumber(match[2]);
                if (!(value > 0)) continue;

                var hasCurrency = !!match[1];
                var hasFormat = /[,.]/.test(match[2]);
                if (!hasCurrency && !hasFormat && !labelled) continue;     // a bare number is too uncertain

                var score = 0;
                if (hasCurrency) score += 5;
                if (labelled) score += 4;
                if (hasFormat) score += 1;
                if (isSub) score -= 3;
                if (minor) score -= 4;
                if (index < 2) score -= 1;

                if (!best || score > best.score || (score === best.score && value > best.value)) {
                    best = { value: value, score: score };
                }
            }
        });

        return best && best.score > 0 ? best.value : 0;
    }

    // "Oct", "October", "Sept" -> 10 (0 when it is not a month)
    function monthNumber(word) {
        var w = String(word).toLowerCase();
        return MONTHS[w.slice(0, 4)] || MONTHS[w.slice(0, 3)] || 0;
    }

    // OCR often reads 1 as l or I and 0 as O inside a date like 2l/lO/2026
    function fixDateDigits(text) {
        return text.replace(/\b[0-9lIOo]{1,2}[\/.\-][0-9lIOo]{1,2}[\/.\-][0-9lIOo]{2,4}\b/g, function (token) {
            return token.replace(/[lI]/g, "1").replace(/[Oo]/g, "0");
        });
    }

    function findDate(text) {
        text = fixDateDigits(text);
        var m;

        // 2026-10-21
        m = /\b(20\d{2})[\/.\-](\d{1,2})[\/.\-](\d{1,2})\b/.exec(text);
        if (m) { var iso = realDate(+m[1], +m[2], +m[3]); if (iso) return iso; }

        // 21/10/2026, 21-10-26 (day first, the usual order in Nigeria)
        m = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/.exec(text);
        if (m) {
            var d = +m[1], mo = +m[2];
            var result = realDate(+m[3], mo, d) || realDate(+m[3], d, mo);   // swap if it was month first
            if (result) return result;
        }

        // 21 Oct 2026, 21st October, 2026
        m = /\b(\d{1,2})(?:st|nd|rd|th)?[ ,\-]+([A-Za-z]{3,9})[ ,.\-]+(\d{2,4})\b/.exec(text);
        if (m) {
            var mon = monthNumber(m[2]);
            if (mon) { var r2 = realDate(+m[3], mon, +m[1]); if (r2) return r2; }
        }

        // Oct 21, 2026
        m = /\b([A-Za-z]{3,9})[ .]+(\d{1,2})(?:st|nd|rd|th)?,?[ ]+(\d{4})\b/.exec(text);
        if (m) {
            var mon2 = monthNumber(m[1]);
            if (mon2) { var r3 = realDate(+m[3], mon2, +m[2]); if (r3) return r3; }
        }

        return "";
    }

    function findTime(text) {
        var m = /\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\s?(AM|PM|am|pm)?/.exec(text);
        if (!m) return "";
        var h = +m[1];
        var ap = (m[3] || "").toLowerCase();
        if (ap === "pm" && h < 12) h += 12;
        if (ap === "am" && h === 12) h = 0;
        if (h > 23) return "";
        return pad2(h) + ":" + m[2];
    }

    function firstMatch(text, labels) {
        var lines = text.split("\n");
        for (var i = 0; i < lines.length; i++) {
            var m = labels.exec(lines[i]);
            if (m) {
                var rest = (m[2] || "").replace(/^[\s:\-.]+/, "").trim();
                var generic = /^(details?|information|info|name|account|acct|no|number|bank)$/i;
                if ((!rest || generic.test(rest)) && lines[i + 1]) rest = lines[i + 1].trim();   // the name is on the next line
                if ((!rest || generic.test(rest)) ) continue;
                if (rest.replace(/\D/g, "").length >= 3) continue;      // a number or amount, not a name
                rest = rest.replace(/[^A-Za-z0-9 &'.\-\/]/g, " ").replace(/\s+/g, " ").trim();
                if (rest.length >= 3 && /[A-Za-z]{2}/.test(rest)) return rest;
            }
        }
        return "";
    }

    function titleCase(text) {
        return text.toLowerCase().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
    }

    // text -> { amount, date, time, type, description, category }  (anything not found is "" or 0)
    function parseReceiptText(raw) {
        var text = cleanText(raw);
        var lower = text.toLowerCase();

        var incomeScore = 0, expenseScore = 0;
        if (/\b(credit|credited|received|deposit|inward|cr)\b/.test(lower)) incomeScore += 2;
        if (/\b(sender|originator|from)\b/.test(lower)) incomeScore += 1;
        if (/\b(debit|debited|transfer to|sent to|paid|payment|purchase|withdraw|withdrawal|pos|airtime|bill|dr|total|beneficiary|recipient)\b/.test(lower)) expenseScore += 2;
        if (/\b(debit|debited)\b/.test(lower)) expenseScore += 2;
        var type = incomeScore > expenseScore ? "income" : "expense";

        var description = "";
        var narration = firstMatch(text, /\b(narration|description|desc|remarks?)\b(.*)/i);

        if (narration) {
            description = titleCase(narration);
            if (type === "income") {
                var who = firstMatch(text, /\b(sender(?:'s)? name|sender|originator|received from)\b(.*)/i);
                if (who) description += " (from " + titleCase(who) + ")";
            }
        } else if (type === "income") {
            var sender = firstMatch(text, /\b(sender(?:'s)? name|sender|originator|from|received from)\b(.*)/i);
            if (sender) description = "Transfer from " + titleCase(sender);
        } else {
            var to = firstMatch(text, /\b(beneficiary name|beneficiary|recipient name|recipient|account name|paid to|transfer to|sent to|merchant|payee)\b(.*)/i);
            if (to) description = "Transfer to " + titleCase(to);
        }

        if (!description) {
            // Receipts: the shop name is usually near the top
            var skip = /receipt|customer copy|merchant copy|thank|welcome|invoice|tel|phone|address|date|time|cashier|terminal|\bpos\b|reference|ref\b|session|transaction|successful|approved|^\s*[\d\W]+$/i;
            var lines = text.split("\n").map(function (l) { return l.replace(/[^A-Za-z0-9 &'.\-]/g, " ").replace(/\s+/g, " ").trim(); });
            for (var i = 0; i < Math.min(lines.length, 8); i++) {
                if (lines[i].length >= 3 && /[A-Za-z]{3}/.test(lines[i]) && !skip.test(lines[i])) {
                    description = titleCase(lines[i]);
                    break;
                }
            }
        }

        if (description.length > 60) description = description.slice(0, 60).trim();

        var category = "";
        for (var c = 0; c < CATEGORY_WORDS.length; c++) {
            if (CATEGORY_WORDS[c][1].test(text)) { category = CATEGORY_WORDS[c][0]; break; }
        }

        return {
            amount: findAmount(text),
            date: findDate(text),
            time: findTime(text),
            type: type,
            description: description,
            category: category
        };
    }

    // =========================================================
    // PART 2: working with the picture in the browser
    // =========================================================

    if (typeof document === "undefined") {
        root.parseReceiptText = parseReceiptText;
        if (typeof module !== "undefined") module.exports = { parseReceiptText: parseReceiptText };
        return;
    }

    var API = "http://localhost:5000/api/attachments";
    var MAX_FILE_BYTES = 15 * 1024 * 1024;       // the original photo
    var MAX_STORED_BYTES = 480 * 1024;           // after shrinking (the server accepts about 520 KB)
    var TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";

    function token() { return localStorage.getItem("cashbookToken"); }

    function loadImage(file) {
        return new Promise(function (resolve, reject) {
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
            img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("That file could not be opened as a picture.")); };
            img.src = url;
        });
    }

    function drawScaled(img, maxSide) {
        var scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";                    // JPEG has no see-through areas
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas;
    }

    function dataUrlBytes(dataUrl) {
        return Math.floor((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
    }

    // Shrinks a photo until it is small enough to keep: { dataUrl, canvas }
    function shrink(file) {
        return loadImage(file).then(function (img) {
            var sides = [1600, 1300, 1100, 900, 720];
            var qualities = [0.78, 0.68, 0.58, 0.48];
            var canvas, dataUrl;

            for (var s = 0; s < sides.length; s++) {
                canvas = drawScaled(img, sides[s]);
                for (var q = 0; q < qualities.length; q++) {
                    dataUrl = canvas.toDataURL("image/jpeg", qualities[q]);
                    if (dataUrlBytes(dataUrl) <= MAX_STORED_BYTES) return { dataUrl: dataUrl, canvas: canvas };
                }
            }
            throw new Error("That picture is too detailed to save. Please try a smaller one.");
        });
    }

    // Grey + more contrast makes printed text easier to read for the scanner
    function forOcr(canvas) {
        var copy = document.createElement("canvas");
        copy.width = canvas.width;
        copy.height = canvas.height;
        var ctx = copy.getContext("2d");
        ctx.drawImage(canvas, 0, 0);

        var image = ctx.getImageData(0, 0, copy.width, copy.height);
        var px = image.data;
        var low = 255, high = 0, i, g;

        for (i = 0; i < px.length; i += 4) {
            g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
            px[i] = px[i + 1] = px[i + 2] = g;
            if (g < low) low = g;
            if (g > high) high = g;
        }

        var range = Math.max(1, high - low);
        for (i = 0; i < px.length; i += 4) {
            var v = ((px[i] - low) / range) * 255;
            px[i] = px[i + 1] = px[i + 2] = v;
        }

        ctx.putImageData(image, 0, 0);
        return copy;
    }

    var tesseractPromise = null;
    function loadTesseract() {
        if (root.Tesseract) return Promise.resolve(root.Tesseract);
        if (tesseractPromise) return tesseractPromise;

        tesseractPromise = new Promise(function (resolve, reject) {
            var script = document.createElement("script");
            script.src = TESSERACT_URL;
            script.async = true;
            script.onload = function () { root.Tesseract ? resolve(root.Tesseract) : reject(new Error("The scanner did not start.")); };
            script.onerror = function () { tesseractPromise = null; reject(new Error("The scanner could not be loaded. Check your internet connection.")); };
            document.head.appendChild(script);
        });

        return tesseractPromise;
    }

    function recognise(canvas, onProgress) {
        return loadTesseract().then(function (Tesseract) {
            return Tesseract.recognize(canvas, "eng", {
                logger: function (m) {
                    if (m && m.status === "recognizing text" && typeof m.progress === "number") onProgress(m.progress);
                }
            });
        }).then(function (result) { return result.data.text || ""; });
    }

    function api(method, path, body) {
        return fetch(API + path, {
            method: method,
            headers: { "Authorization": "Bearer " + token(), "Content-Type": "application/json" },
            body: body ? JSON.stringify(body) : undefined
        }).then(function (response) {
            return response.json().catch(function () { return {}; }).then(function (data) {
                if (!response.ok) throw new Error(data.message || "Something went wrong with the picture.");
                return data;
            });
        });
    }

    // ---------------------------------------------------------
    // Look of the widget and the viewer (plain CSS, light and dark)
    // ---------------------------------------------------------
    function addStyles() {
        if (document.getElementById("rcpt-style")) return;
        var css = [
            ".rcpt{border:1px dashed #cbd5e1;border-radius:12px;padding:12px;background:rgba(148,163,184,.08)}",
            "html.dark .rcpt{border-color:#475569}",
            ".rcpt-title{margin:0 0 8px;font-size:13px;font-weight:600;color:#334155}",
            "html.dark .rcpt-title{color:#e2e8f0}",
            ".rcpt-title span{font-weight:400;color:#94a3b8}",
            ".rcpt-row{display:flex;flex-wrap:wrap;gap:8px}",
            ".rcpt-btn{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 12px;border-radius:9px;border:1px solid #cbd5e1;background:#fff;color:#334155;font:inherit;font-size:13px;font-weight:600;cursor:pointer}",
            "html.dark .rcpt-btn{background:#1e293b;border-color:#475569;color:#e2e8f0}",
            ".rcpt-btn:hover{border-color:#22c55e;color:#16a34a}",
            ".rcpt-btn:disabled{opacity:.55;cursor:not-allowed}",
            ".rcpt-btn:focus-visible{outline:3px solid rgba(34,197,94,.45);outline-offset:1px}",
            ".rcpt-primary{background:#22c55e;border-color:#22c55e;color:#fff}",
            "html.dark .rcpt-primary{background:#22c55e;border-color:#22c55e;color:#fff}",
            ".rcpt-primary:hover{background:#16a34a;color:#fff}",
            ".rcpt-preview{display:flex;align-items:center;gap:12px;margin-top:10px}",
            ".rcpt-preview img{width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #cbd5e1;background:#fff;cursor:zoom-in;flex:none}",
            ".rcpt-meta{min-width:0;flex:1;font-size:12px;color:#64748b}",
            ".rcpt-meta strong{display:block;font-size:13px;color:#334155;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
            "html.dark .rcpt-meta strong{color:#e2e8f0}",
            ".rcpt-link{border:0;background:none;padding:0;margin-right:12px;font:inherit;font-size:12px;color:#16a34a;cursor:pointer;text-decoration:underline}",
            ".rcpt-link.rcpt-danger{color:#ef4444}",
            ".rcpt-status{margin:8px 0 0;font-size:12px;line-height:1.45;color:#64748b;min-height:0}",
            ".rcpt-status.rcpt-bad{color:#ef4444}",
            ".rcpt-status.rcpt-good{color:#16a34a}",
            ".rcpt-bar{height:5px;border-radius:99px;background:#e2e8f0;margin-top:8px;overflow:hidden}",
            ".rcpt-bar i{display:block;height:100%;width:0;background:#22c55e;transition:width .2s}",
            ".rcpt-view{position:fixed;inset:0;z-index:2147482000;background:rgba(2,6,23,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px}",
            ".rcpt-view img{max-width:100%;max-height:calc(100vh - 90px);border-radius:8px;background:#fff}",
            ".rcpt-view-bar{display:flex;gap:10px;margin-bottom:12px}",
            ".rcpt-view-bar button,.rcpt-view-bar a{display:inline-flex;align-items:center;height:38px;padding:0 14px;border-radius:9px;border:0;background:#fff;color:#0f172a;font:600 13px Inter,system-ui,sans-serif;cursor:pointer;text-decoration:none}",
            ".rcpt-view p{color:#e2e8f0;font:14px Inter,system-ui,sans-serif}"
        ].join("\n");
        var style = document.createElement("style");
        style.id = "rcpt-style";
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ---------------------------------------------------------
    // Full-screen picture viewer
    // ---------------------------------------------------------
    function view(id) {
        addStyles();
        var overlay = document.createElement("div");
        overlay.className = "rcpt-view";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-label", "Teller or receipt");
        overlay.innerHTML = '<div class="rcpt-view-bar"><button type="button" data-x>Close</button></div><p>Loading...</p>';
        document.body.appendChild(overlay);

        function close() {
            document.removeEventListener("keydown", onKey, true);
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }
        function onKey(event) { if (event.key === "Escape") { event.stopPropagation(); close(); } }

        overlay.querySelector("[data-x]").addEventListener("click", close);
        overlay.addEventListener("click", function (event) { if (event.target === overlay) close(); });
        document.addEventListener("keydown", onKey, true);
        overlay.querySelector("[data-x]").focus();

        api("GET", "/" + encodeURIComponent(id)).then(function (data) {
            var p = overlay.querySelector("p");
            var img = document.createElement("img");
            img.alt = "Teller or receipt";
            img.src = data.image;
            p.parentNode.replaceChild(img, p);

            var link = document.createElement("a");
            link.href = data.image;
            link.download = "cashbook-receipt.jpg";
            link.textContent = "Save a copy";
            overlay.querySelector(".rcpt-view-bar").appendChild(link);
        }).catch(function (error) {
            overlay.querySelector("p").textContent = error.message;
        });
    }

    // ---------------------------------------------------------
    // The widget
    // ---------------------------------------------------------
    function mount(container, options) {
        options = options || {};
        addStyles();

        var scanOn = !!options.scan;
        var state = { dataUrl: null, canvas: null, name: "", existing: null, removedExisting: false, busy: false };

        container.innerHTML =
            '<div class="rcpt">' +
            '<p class="rcpt-title">' + (options.label || "Teller or receipt") + " <span>(optional)</span></p>" +
            '<div class="rcpt-row">' +
            '<button type="button" class="rcpt-btn" data-act="camera"><i class="fa-solid fa-camera"></i> Take photo</button>' +
            '<button type="button" class="rcpt-btn" data-act="upload"><i class="fa-solid fa-image"></i> Upload image</button>' +
            "</div>" +
            '<input type="file" accept="image/*" capture="environment" hidden data-in="camera">' +
            '<input type="file" accept="image/*" hidden data-in="upload">' +
            '<div class="rcpt-preview" hidden>' +
            '<img alt="Preview of your teller or receipt">' +
            '<div class="rcpt-meta"><strong></strong>' +
            '<button type="button" class="rcpt-link" data-act="view" hidden>View</button>' +
            '<button type="button" class="rcpt-link rcpt-danger" data-act="remove">Remove</button></div>' +
            "</div>" +
            (scanOn ? '<div class="rcpt-row" style="margin-top:10px" hidden data-scanrow><button type="button" class="rcpt-btn rcpt-primary" data-act="scan"><i class="fa-solid fa-wand-magic-sparkles"></i> Scan and fill the form</button></div>' : "") +
            '<div class="rcpt-bar" hidden><i></i></div>' +
            '<p class="rcpt-status" role="status" aria-live="polite"></p>' +
            "</div>";

        var preview = container.querySelector(".rcpt-preview");
        var previewImg = preview.querySelector("img");
        var nameEl = preview.querySelector("strong");
        var viewBtn = preview.querySelector('[data-act="view"]');
        var scanRow = container.querySelector("[data-scanrow]");
        var scanBtn = container.querySelector('[data-act="scan"]');
        var statusEl = container.querySelector(".rcpt-status");
        var bar = container.querySelector(".rcpt-bar");
        var barFill = bar.querySelector("i");
        var inputs = container.querySelectorAll("input[type=file]");

        function say(text, kind) {
            statusEl.textContent = text || "";
            statusEl.className = "rcpt-status" + (kind === "bad" ? " rcpt-bad" : kind === "good" ? " rcpt-good" : "");
        }

        function progress(fraction) {
            bar.hidden = fraction === null;
            if (fraction !== null) barFill.style.width = Math.round(fraction * 100) + "%";
        }

        function refresh() {
            var hasNew = !!state.dataUrl;
            var hasOld = !!state.existing && !state.removedExisting;

            preview.hidden = !(hasNew || hasOld);
            viewBtn.hidden = !hasOld || hasNew;
            if (hasNew) {
                previewImg.src = state.dataUrl;
                nameEl.textContent = state.name || "New picture";
            } else if (hasOld) {
                previewImg.removeAttribute("src");
                nameEl.textContent = "A picture is attached";
            }
            if (scanRow) scanRow.hidden = !hasNew;
        }

        function pick(file) {
            if (!file) return;
            if (!/^image\//.test(file.type)) { say("Please choose a picture (JPG, PNG or WebP).", "bad"); return; }
            if (file.size > MAX_FILE_BYTES) { say("That picture is too big. Please choose one under 15 MB.", "bad"); return; }

            say("Preparing the picture...");
            shrink(file).then(function (result) {
                state.dataUrl = result.dataUrl;
                state.canvas = result.canvas;
                state.name = file.name && file.name !== "image.jpg" ? file.name : "Photo " + new Date().toLocaleTimeString();
                state.removedExisting = false;
                refresh();
                say(scanOn ? "Picture ready. Press Scan to fill the form from it, or just save it with your record." : "Picture ready. It will be saved with your record.");
                if (options.onChange) options.onChange(true);
            }).catch(function (error) { say(error.message, "bad"); });
        }

        Array.prototype.forEach.call(inputs, function (input) {
            input.addEventListener("change", function () {
                pick(input.files && input.files[0]);
                input.value = "";           // lets the same picture be chosen again
            });
        });

        container.addEventListener("click", function (event) {
            var button = event.target.closest("[data-act]");
            if (!button) return;
            var act = button.getAttribute("data-act");

            if (act === "camera") container.querySelector('[data-in="camera"]').click();
            if (act === "upload") container.querySelector('[data-in="upload"]').click();
            if (act === "view" && state.existing) view(state.existing);
            if (act === "remove") {
                state.dataUrl = null;
                state.canvas = null;
                if (state.existing) state.removedExisting = true;
                refresh();
                say("");
                progress(null);
                if (options.onChange) options.onChange(false);
            }
            if (act === "scan") runScan();
        });

        previewImg.addEventListener("click", function () {
            if (state.existing && !state.dataUrl) view(state.existing);
        });

        function runScan() {
            if (state.busy || !state.canvas) return;
            state.busy = true;
            scanBtn.disabled = true;
            say("Starting the scanner. The first time it downloads a few MB, so use Wi-Fi if you can...");
            progress(0);

            recognise(forOcr(state.canvas), function (fraction) {
                progress(fraction);
                say("Reading the picture... " + Math.round(fraction * 100) + "%");
            }).then(function (text) {
                var found = parseReceiptText(text);
                var useful = found.amount > 0 || !!found.date;

                if (!useful) {
                    say("The scanner could not find any details. Try a clearer, straighter photo, or fill the form yourself.", "bad");
                } else {
                    if (options.onScan) options.onScan(found, text);
                    say(found.amount > 0
                        ? "Done. Please check the amount, date and description before saving."
                        : "Some details were found, but not the amount. Please fill in the rest yourself.", found.amount > 0 ? "good" : "bad");
                }
            }).catch(function (error) {
                say(error.message || "The scan did not work. You can still save the picture and fill the form yourself.", "bad");
            }).then(function () {
                state.busy = false;
                scanBtn.disabled = false;
                progress(null);
            });
        }

        return {
            // Show a picture that is already saved (used when editing a record)
            setExisting: function (id) {
                state.dataUrl = null;
                state.canvas = null;
                state.existing = id || null;
                state.removedExisting = false;
                say("");
                progress(null);
                refresh();
            },

            reset: function () {
                state.dataUrl = null;
                state.canvas = null;
                state.existing = null;
                state.removedExisting = false;
                say("");
                progress(null);
                refresh();
            },

            // Saves a newly chosen picture and says what the record should store
            prepare: function () {
                if (state.dataUrl) {
                    return api("POST", "", { image: state.dataUrl }).then(function (data) {
                        return { value: data.id, uploaded: true };
                    });
                }
                if (state.existing && state.removedExisting) return Promise.resolve({ value: null });
                return Promise.resolve({ value: undefined });
            },

            hasNew: function () { return !!state.dataUrl; }
        };
    }

    function discard(id) {
        if (!id) return Promise.resolve();
        return api("DELETE", "/" + encodeURIComponent(id)).catch(function () { /* nothing to do */ });
    }

    // Puts the scanner's answers into a transaction form. Only fields that exist are touched,
    // and the category is only set if the list really has it.
    function fillTransactionForm(found, ids) {
        function put(id, value) {
            var el = document.getElementById(id);
            if (!el || value === "" || value === undefined || value === null) return;
            el.value = value;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
        }

        put(ids.amount, found.amount > 0 ? found.amount : "");
        put(ids.description, found.description);
        put(ids.date, found.date);
        put(ids.time, found.time);

        if (found.category && ids.category) {
            var select = document.getElementById(ids.category);
            if (select && Array.prototype.some.call(select.options, function (o) { return o.value === found.category; })) {
                put(ids.category, found.category);
            }
        }
    }

    root.CashbookReceipt = {
        mount: mount,
        view: view,
        discard: discard,
        parse: parseReceiptText,
        fillTransactionForm: fillTransactionForm
    };
})(typeof window !== "undefined" ? window : globalThis);
