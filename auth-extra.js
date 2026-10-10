// =====================================================
// Google sign-in + Forgot password (login page only)
// =====================================================
const API_URL = "http://localhost:5000/api";

// Paste your Google OAuth Client ID here (ends with .apps.googleusercontent.com)
const GOOGLE_CLIENT_ID = "959840872645-549sfue21i870l6cfck8je6t5co2pska.apps.googleusercontent.com";

document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    const message = document.getElementById("message");

    function showMessage(text, isError) {
        if (!message) return;
        message.textContent = text;
        message.className =
            "text-center text-sm mb-4 font-semibold " +
            (isError ? "text-red-500" : "text-green");
    }

    // =====================================================
    // GOOGLE SIGN-IN
    // =====================================================
    const googleContainer = document.getElementById("google-btn-container");

    async function handleGoogleCredential(response) {
        try {
            showMessage("Signing in with Google...", false);

            const res = await fetch(API_URL + "/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential: response.credential })
            });

            const data = await res.json();

            if (!res.ok) {
                showMessage(data.message || "Google sign-in failed.", true);
                return;
            }

            localStorage.setItem("cashbookToken", data.token);
            localStorage.setItem("cashbookUser", JSON.stringify(data.user));

            showMessage("Login successful!", false);

            setTimeout(function () {
                window.location.href = "welcome.html";
            }, 800);

        } catch (error) {
            console.error("Google sign-in error:", error);
            showMessage("Unable to connect to the server.", true);
        }
    }

    // The four-colour Google "G" shown on the backup button
    const GOOGLE_ICON =
        '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path fill="#4285F4" d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42z"/>' +
        '<path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.29v2.53A9.75 9.75 0 0 0 12 21.75z"/>' +
        '<path fill="#FBBC05" d="M6.54 13.83A5.86 5.86 0 0 1 6.23 12c0-.64.11-1.26.31-1.83V7.64H3.29A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.04 4.36l3.25-2.53z"/>' +
        '<path fill="#EA4335" d="M12 6.14c1.43 0 2.72.49 3.73 1.45l2.79-2.79C16.84 3.17 14.63 2.25 12 2.25a9.75 9.75 0 0 0-8.71 5.39l3.25 2.53C7.31 7.86 9.46 6.14 12 6.14z"/>' +
        "</svg>";

    // Login tab and Sign up tab each get a Google button
    const googleTargets = [
        { el: googleContainer, label: "Continue with Google", text: "continue_with" },
        { el: document.getElementById("google-btn-container-signup"), label: "Sign up with Google", text: "signup_with" }
    ].filter(function (t) { return t.el; });

    // A plain button that explains what is wrong when the real Google button cannot be shown
    function showGoogleUnavailable(reason) {
        googleTargets.forEach(function (t) {
            t.el.innerHTML =
                '<button type="button" class="w-full flex items-center justify-center gap-3 border border-slate-300 bg-white text-slate-700 py-3 rounded-lg font-semibold hover:bg-slate-50">' +
                GOOGLE_ICON + "<span>" + t.label + "</span></button>";
            t.el.firstChild.addEventListener("click", function () {
                showMessage(reason, true);
            });
        });
    }

    function setupGoogle() {
        if (!googleTargets.length) return;

        if (GOOGLE_CLIENT_ID.indexOf("PASTE_") === 0) {
            showGoogleUnavailable("Google sign-in is not configured yet (missing Client ID).");
            return;
        }

        if (!/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(GOOGLE_CLIENT_ID.trim())) {
            showGoogleUnavailable("The Google Client ID in auth-extra.js looks wrong. It should look like 1234567890-abcdef.apps.googleusercontent.com, with nothing else inside the quotes.");
            return;
        }

        let tries = 0;

        // The Google script loads asynchronously, so wait for it
        const timer = setInterval(function () {
            tries++;

            if (window.google && google.accounts && google.accounts.id) {
                clearInterval(timer);

                google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID.trim(),
                    callback: handleGoogleCredential
                });

                // Measure the visible Login button area; the Sign up tab is hidden so it cannot be measured
                const width = Math.min(Math.max(googleTargets[0].el.offsetWidth, 240), 400);

                googleTargets.forEach(function (t) {
                    google.accounts.id.renderButton(t.el, {
                        theme: "outline",
                        size: "large",
                        text: t.text,
                        shape: "rectangular",
                        width: width
                    });
                });

                // Google needs this exact address listed under "Authorized JavaScript origins"
                console.info("Google sign-in is running from: " + window.location.origin +
                    "  (this exact address must be listed under Authorized JavaScript origins in Google Cloud)");

                // If Google drew nothing, say why instead of leaving an empty gap
                setTimeout(function () {
                    const drawn = googleTargets.some(function (t) { return t.el.querySelector("iframe"); });
                    if (!drawn) {
                        showGoogleUnavailable("Google did not show its button. Add " + window.location.origin +
                            " under Authorized JavaScript origins for this Client ID (Google Cloud > Clients), wait a few minutes, then refresh.");
                    }
                }, 3000);
            } else if (tries > 50) {
                clearInterval(timer);
                showGoogleUnavailable("Could not load Google sign-in. Check your internet connection or turn off any ad blocker for this page.");
            }
        }, 100);
    }

    setupGoogle();

    // =====================================================
    // FORGOT PASSWORD
    // =====================================================
    const forgotLink = document.getElementById("forgot-password-link");
    const forgotModal = document.getElementById("forgot-modal");
    const forgotForm = document.getElementById("forgot-form");
    const forgotEmail = document.getElementById("forgot-email");
    const forgotStatus = document.getElementById("forgot-status");
    const forgotSubmit = document.getElementById("forgot-submit");

    function openForgot() {
        if (!forgotModal) return;

        // Pre-fill with whatever email was typed on the login form
        const loginField = document.getElementById("login-identifier");
        if (loginField && loginField.value.indexOf("@") > -1) {
            forgotEmail.value = loginField.value.trim();
        }

        forgotStatus.textContent = "";
        forgotModal.classList.remove("hidden");
        forgotModal.classList.add("flex");
        forgotEmail.focus();
    }

    function closeForgot() {
        forgotModal.classList.add("hidden");
        forgotModal.classList.remove("flex");
    }

    if (forgotLink) forgotLink.addEventListener("click", openForgot);

    document.querySelectorAll("[data-close-forgot]").forEach(function (el) {
        el.addEventListener("click", closeForgot);
    });

    if (forgotForm) {
        forgotForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const email = forgotEmail.value.trim();

            if (!email || email.indexOf("@") === -1) {
                forgotStatus.textContent = "Please enter a valid email address.";
                forgotStatus.className = "text-sm mb-3 text-red-500 font-semibold";
                return;
            }

            forgotSubmit.disabled = true;
            forgotSubmit.textContent = "Sending...";

            try {
                const res = await fetch(API_URL + "/auth/forgot-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: email })
                });

                const data = await res.json();

                forgotStatus.textContent = data.message || "Request sent.";
                forgotStatus.className =
                    "text-sm mb-3 font-semibold " + (res.ok ? "text-green" : "text-red-500");

            } catch (error) {
                console.error("Forgot password error:", error);
                forgotStatus.textContent = "Unable to connect to the server.";
                forgotStatus.className = "text-sm mb-3 text-red-500 font-semibold";
            }

            forgotSubmit.disabled = false;
            forgotSubmit.textContent = "Send Reset Link";
        });
    }
});
