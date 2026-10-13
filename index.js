// ===============================
// GET HTML ELEMENTS
// ===============================

const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");

const loginTab = document.getElementById("login-tab");
const signupTab = document.getElementById("signup-tab");

const subtitle = document.getElementById("subtitle");
const footer = document.getElementById("footer");
const message = document.getElementById("message");



// ===============================
// SWITCH BETWEEN LOGIN AND SIGN UP
// ===============================

function switchTab(tab) {
    message.textContent = "";

    if (tab === "login") {
        loginForm.classList.remove("hidden");
        signupForm.classList.add("hidden");

        loginTab.className =
            "w-1/2 bg-white text-navy rounded-md py-2 font-semibold shadow";
        signupTab.className =
            "w-1/2 text-slate-500 rounded-md py-2 font-semibold";

        subtitle.textContent = "Manage your daily cash flow";

        footer.innerHTML =
            'Don\'t have an account? ' +
            '<button id="footer-link" type="button" class="text-green font-semibold hover:underline ms-1">' +
            'Sign up' +
            '</button>';
    } else {
        loginForm.classList.add("hidden");
        signupForm.classList.remove("hidden");

        loginTab.className =
            "w-1/2 text-slate-500 rounded-md py-2 font-semibold";
        signupTab.className =
            "w-1/2 bg-white text-navy rounded-md py-2 font-semibold shadow";

        subtitle.textContent = "Create your CashBook account";

        footer.innerHTML =
            'Already have an account? ' +
            '<button id="footer-link" type="button" class="text-green font-semibold hover:underline ms-1">' +
            'Login' +
            '</button>';
    }
}

// Event delegation for dynamic footer link clicks
footer.addEventListener("click", function (event) {
    if (event.target && event.target.id === "footer-link") {
        const isLoginVisible = !loginForm.classList.contains("hidden");
        switchTab(isLoginVisible ? "signup" : "login");
    }
});

// ===============================
// TAB BUTTONS
// ===============================

loginTab.addEventListener("click", function () {
    switchTab("login");
});

signupTab.addEventListener("click", function () {
    switchTab("signup");
});

// ===============================
// SHOW / HIDE PASSWORD
// ===============================

const passwordButtons = document.querySelectorAll(".password-toggle");

passwordButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        const fieldId = button.dataset.target;
        const field = document.getElementById(fieldId);
        const icon = button.querySelector("svg");

        if (field.type === "password") {
            field.type = "text";
            icon.innerHTML = `
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8 a18.45 18.45 0 0 1 5.06-5.94 M9.9 4.24A9.12 9.12 0 0 1 12 4 c7 0 11 8 11 8 a18.5 18.5 0 0 1-2.16 3.19 m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            `;
        } else {
            field.type = "password";
            icon.innerHTML = `
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            `;
        }
    });
});

// ===============================
// SIGN UP (two steps)
//   1. The form is sent to the server, which texts or emails a 6-digit code.
//   2. The person types the code; only then is the account created.
// ===============================
const otpModal = document.getElementById("otp-modal");
const otpForm = document.getElementById("otp-form");
const otpCode = document.getElementById("otp-code");
const otpStatus = document.getElementById("otp-status");
const otpIntro = document.getElementById("otp-intro");
const otpSubmit = document.getElementById("otp-submit");
const otpResend = document.getElementById("otp-resend");
const otpSwitch = document.getElementById("otp-switch");
const otpClose = document.getElementById("otp-close");

let pendingSignup = null;     // { email, method, sentTo }
let resendTimer = null;

function setMessage(text, isError) {
    message.textContent = text;
    message.className =
        "text-center text-sm mb-4 font-semibold " +
        (isError ? "text-red-500" : "text-green");
}

function setOtpStatus(text, isError) {
    otpStatus.textContent = text || "";
    otpStatus.className = "text-sm mb-3 font-semibold " + (isError ? "text-red-500" : "text-green");
}

function showOtpModal() {
    otpModal.classList.remove("hidden");
    otpModal.classList.add("flex");
    otpCode.value = "";
    otpCode.focus();
}

function hideOtpModal() {
    otpModal.classList.add("hidden");
    otpModal.classList.remove("flex");
    clearInterval(resendTimer);
}

function describeMethod(method) {
    return method === "phone" ? "phone number" : "email address";
}

function renderOtpIntro() {
    otpIntro.textContent =
        "We sent a 6-digit code to " + pendingSignup.sentTo +
        ". Enter it below to confirm your " + describeMethod(pendingSignup.method) + ". The code works for 10 minutes.";

    otpSwitch.textContent =
        pendingSignup.method === "phone" ? "Send to my email instead" : "Send to my phone instead";
}

function startResendCountdown(seconds) {
    clearInterval(resendTimer);

    let left = seconds;

    function tick() {
        if (left > 0) {
            otpResend.disabled = true;
            otpResend.textContent = "Resend code in " + left + "s";
            left--;
        } else {
            otpResend.disabled = false;
            otpResend.textContent = "Resend code";
            clearInterval(resendTimer);
        }
    }

    tick();
    resendTimer = setInterval(tick, 1000);
}

async function postJson(url, body) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    let data = {};
    try { data = await response.json(); } catch (e) { /* not JSON */ }

    return { ok: response.ok, status: response.status, data: data };
}

signupForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const fullName = document.getElementById("signup-name").value.trim();
    const mobile = document.getElementById("signup-mobile").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const book = document.getElementById("signup-book").value.trim();
    const password = document.getElementById("signup-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;
    const checked = document.querySelector('input[name="verify-method"]:checked');
    const method = checked ? checked.value : "email";

    if (password !== confirmPassword) {
        setMessage("Passwords do not match.", true);
        return;
    }

    if (password.length < 6) {
        setMessage("Password must be at least 6 characters.", true);
        return;
    }

    const submitButton = signupForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    setMessage("Sending your verification code...", false);

    try {
        const result = await postJson("http://localhost:5000/api/auth/register/start", {
            fullName, mobile, email, book, password, method
        });

        if (!result.ok) {
            setMessage(result.data.message || "Registration failed.", true);
            return;
        }

        pendingSignup = { email: email, method: result.data.method, sentTo: result.data.sentTo };

        setMessage("", false);
        setOtpStatus("", false);
        renderOtpIntro();
        showOtpModal();
        startResendCountdown(result.data.resendIn || 60);

    } catch (error) {
        console.error("Registration error:", error);
        setMessage("Unable to connect to the server.", true);
    } finally {
        submitButton.disabled = false;
    }
});

otpForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!pendingSignup) return;

    const code = otpCode.value.trim();

    if (!/^[0-9]{6}$/.test(code)) {
        setOtpStatus("Enter the 6-digit code.", true);
        return;
    }

    otpSubmit.disabled = true;
    setOtpStatus("Checking...", false);

    try {
        const result = await postJson("http://localhost:5000/api/auth/register/verify", {
            email: pendingSignup.email,
            code: code
        });

        if (!result.ok) {
            setOtpStatus(result.data.message || "That code did not work.", true);
            return;
        }

        // Save JWT token so the user is logged in after registering
        localStorage.setItem("cashbookToken", result.data.token);
        localStorage.setItem("cashbookUser", JSON.stringify(result.data.user));

        setOtpStatus("Verified! Taking you in...", false);

        setTimeout(function () {
            window.location.href = "welcome.html";
        }, 800);

    } catch (error) {
        console.error("Verify error:", error);
        setOtpStatus("Unable to connect to the server.", true);
    } finally {
        otpSubmit.disabled = false;
    }
});

async function resendCode(method) {
    if (!pendingSignup) return;

    setOtpStatus("Sending a new code...", false);
    otpResend.disabled = true;

    try {
        const result = await postJson("http://localhost:5000/api/auth/register/resend", {
            email: pendingSignup.email,
            method: method
        });

        if (!result.ok) {
            setOtpStatus(result.data.message || "Could not send a new code.", true);
            startResendCountdown(result.data.resendIn || 0);
            return;
        }

        pendingSignup.method = result.data.method;
        pendingSignup.sentTo = result.data.sentTo;
        renderOtpIntro();
        otpCode.value = "";
        otpCode.focus();
        setOtpStatus(result.data.message, false);
        startResendCountdown(result.data.resendIn || 60);

    } catch (error) {
        console.error("Resend error:", error);
        setOtpStatus("Unable to connect to the server.", true);
        startResendCountdown(0);
    }
}

otpResend.addEventListener("click", function () {
    resendCode(pendingSignup && pendingSignup.method);
});

otpSwitch.addEventListener("click", function () {
    resendCode(pendingSignup && pendingSignup.method === "phone" ? "email" : "phone");
});

otpClose.addEventListener("click", hideOtpModal);

// Only digits in the code box
otpCode.addEventListener("input", function () {
    otpCode.value = otpCode.value.replace(/\D/g, "").slice(0, 6);
});

// ===============================
// LOGIN
// ===============================
loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const identifier = document
        .getElementById("login-identifier")
        .value
        .trim();

    const password = document
        .getElementById("login-password")
        .value;

    // Check that both fields were entered
    if (!identifier || !password) {
        message.textContent =
            "Please enter your email/phone number and password.";

        message.className =
            "text-center text-sm mb-4 text-red-500 font-semibold";

        return;
    }

    try {
        // Send login details to backend
        const response = await fetch(
            "http://localhost:5000/api/auth/login",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    identifier: identifier,
                    password: password
                })
            }
        );

        const data = await response.json();

        // Login failed
        if (!response.ok) {
            message.textContent =
                data.message || "Login failed.";

            message.className =
                "text-center text-sm mb-4 text-red-500 font-semibold";

            return;
        }

        // Save JWT token
        localStorage.setItem(
            "cashbookToken",
            data.token
        );

        // Save safe user information
        localStorage.setItem(
            "cashbookUser",
            JSON.stringify(data.user)
        );

        message.textContent =
            "Login successful!";

        message.className =
            "text-center text-sm mb-4 text-green font-semibold";

        // Go to welcome page
        setTimeout(function () {
            window.location.href = "welcome.html";
        }, 1000);

    } catch (error) {
        console.error("Login error:", error);

        message.textContent =
            "Unable to connect to the server.";

        message.className =
            "text-center text-sm mb-4 text-red-500 font-semibold";
    }
});

// ===============================
// FORGOT PASSWORD & GOOGLE LOGIN
// ===============================

const forgotPassword = document.getElementById("forgot-password");
if (forgotPassword) {
    forgotPassword.addEventListener("click", function () {
        message.textContent = "Password reset will be connected to your backend.";
        message.className = "text-center text-sm mb-4 text-green font-semibold";
    });
}

const googleLogin = document.getElementById("google-login");
if (googleLogin) {
    googleLogin.addEventListener("click", function () {
        message.textContent = "Google login will be connected to your backend.";
        message.className = "text-center text-sm mb-4 text-green font-semibold";
    });
}