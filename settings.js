// ========================================
// CASHBOOK SETTINGS
// ========================================


// ========================================
// GET USER
// ========================================

let user = JSON.parse(
    localStorage.getItem("cashbookUser")
);


// If no user is logged in
if (!user) {

    window.location.href = "index.html";

}


// ========================================
// SERVER CONNECTION
// ========================================

const API_URL = "http://localhost:5000/api";

const token = localStorage.getItem("cashbookToken");


// No login token means the user must log in again
if (!token) {

    localStorage.removeItem("cashbookUser");

    window.location.href = "index.html";

}


function authHeaders() {

    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
    };

}


function saveUser(freshUser) {

    user = Object.assign({}, user, freshUser);

    localStorage.setItem(
        "cashbookUser",
        JSON.stringify(user)
    );

}


function clearSessionAndLeave() {

    localStorage.removeItem("cashbookUser");
    localStorage.removeItem("cashbookToken");

    window.location.href = "index.html";

}


function showStatus(id, text, isError) {

    const el = document.getElementById(id);

    if (!el) return;

    if (!text) {

        el.textContent = "";
        el.classList.add("hidden");

        return;

    }

    el.textContent = text;

    el.className =
        "text-sm font-semibold " +
        (isError ? "text-red-500" : "text-green");

}


// ========================================
// USER INFORMATION
// ========================================

function getFullName() {

    return (
        user.fullName ||
        user.name ||
        user.username ||
        "CashBook User"
    );

}


function getInitials(name) {

    const words = name.trim().split(/\s+/);

    if (words.length === 1) {

        return words[0].charAt(0).toUpperCase();

    }

    return (
        words[0].charAt(0) +
        words[words.length - 1].charAt(0)
    ).toUpperCase();

}


// ========================================
// DISPLAY USER
// ========================================

function displayUser() {

    const fullName = getFullName();

    const email =
        user.email ||
        "No email available";


    const initials =
        getInitials(fullName);


    // Sidebar
    document.getElementById("sidebar-initials").textContent =
        initials;

    document.getElementById("sidebar-name").textContent =
        fullName;


    // Header
    document.getElementById("header-initials").textContent =
        initials;

    document.getElementById("header-name").textContent =
        fullName;


    // Settings profile
    document.getElementById("settings-profile-name").textContent =
        fullName;

    document.getElementById("settings-profile-email").textContent =
        email;

}


displayUser();


// ========================================
// NAVIGATION
// ========================================

function goTo(page) {

    window.location.href = page;

}


// ========================================
// MOBILE MENU
// ========================================

const sidebar =
    document.getElementById("sidebar");

const overlay =
    document.getElementById("mobile-overlay");

const openMenu =
    document.getElementById("open-menu");


function openSidebar() {

    sidebar.classList.remove("-translate-x-full");

    overlay.classList.remove("hidden");

}


function closeSidebar() {

    sidebar.classList.add("-translate-x-full");

    overlay.classList.add("hidden");

}


openMenu.addEventListener(
    "click",
    openSidebar
);


overlay.addEventListener(
    "click",
    closeSidebar
);


// ========================================
// DARK / LIGHT MODE
// ========================================

const themeToggle =
    document.getElementById("theme-toggle");

const themeCircle =
    document.getElementById("theme-toggle-circle");

const themeIcon =
    document.getElementById("theme-icon");

const themeDescription =
    document.getElementById("theme-description");


// Get saved theme
const savedTheme =
    localStorage.getItem("cashbookTheme");


// Apply saved theme
if (savedTheme === "dark") {

    document.documentElement.classList.add("dark");

    updateThemeButton(true);

} else {

    document.documentElement.classList.remove("dark");

    updateThemeButton(false);

}


// Toggle theme
themeToggle.addEventListener(
    "click",
    function () {

        const isDark =
            document.documentElement.classList.toggle("dark");


        if (isDark) {

            localStorage.setItem(
                "cashbookTheme",
                "dark"
            );

        } else {

            localStorage.setItem(
                "cashbookTheme",
                "light"
            );

        }


        updateThemeButton(isDark);

    }
);


// Update theme button
function updateThemeButton(isDark) {

    if (isDark) {

        themeToggle.classList.add("bg-green");

        themeToggle.classList.remove("bg-slate-300");

        themeCircle.classList.add("translate-x-7");

        themeIcon.className =
            "fas fa-moon";

        themeDescription.textContent =
            "Dark mode is currently enabled.";

    } else {

        themeToggle.classList.remove("bg-green");

        themeToggle.classList.add("bg-slate-300");

        themeCircle.classList.remove("translate-x-7");

        themeIcon.className =
            "fas fa-sun";

        themeDescription.textContent =
            "Light mode is currently enabled.";

    }

}


// ========================================
// EDIT PROFILE MODAL
// ========================================

const editProfileModal =
    document.getElementById("edit-profile-modal");


function openEditProfileModal() {

    // Put existing information into the form

    document.getElementById("edit-full-name").value =
        user.fullName || "";


    document.getElementById("edit-mobile").value =
        user.mobile || "";


    document.getElementById("edit-email").value =
        user.email || "";


    document.getElementById("edit-book").value =
        user.book || "";


    editProfileModal.classList.remove("hidden");

    editProfileModal.classList.add("flex");

}


function closeEditProfileModal() {

    editProfileModal.classList.add("hidden");

    editProfileModal.classList.remove("flex");

}


// ========================================
// SAVE PROFILE CHANGES  (saved in MongoDB)
// ========================================

const editProfileForm =
    document.getElementById("edit-profile-form");


editProfileForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();

        const submitBtn =
            document.getElementById("edit-profile-submit");

        const body = {
            fullName:
                document.getElementById("edit-full-name").value.trim(),
            mobile:
                document.getElementById("edit-mobile").value.trim(),
            book:
                document.getElementById("edit-book").value.trim()
        };

        showStatus("edit-profile-status", "", false);

        submitBtn.disabled = true;

        try {

            const response = await fetch(
                API_URL + "/account/profile",
                {
                    method: "PUT",
                    headers: authHeaders(),
                    body: JSON.stringify(body)
                }
            );

            const data = await response.json();

            if (response.status === 401) {

                clearSessionAndLeave();

                return;

            }

            if (!response.ok) {

                showStatus(
                    "edit-profile-status",
                    data.message || "Unable to save your profile.",
                    true
                );

                return;

            }

            saveUser(data.user);

            displayUser();

            updateSecurityUi();

            closeEditProfileModal();

            alert("Profile updated successfully.");

        } catch (error) {

            console.error("Save profile error:", error);

            showStatus(
                "edit-profile-status",
                "Unable to connect to the CashBook server.",
                true
            );

        } finally {

            submitBtn.disabled = false;

        }

    }
);


// ========================================
// SECURITY INFORMATION
// ========================================

function updateSecurityUi() {

    const hasPassword = user.hasPassword !== false;
    const hasGoogle = Boolean(user.hasGoogle);

    const passwordStatus =
        document.getElementById("password-status");

    const openBtn =
        document.getElementById("password-open-btn");

    const googleStatus =
        document.getElementById("google-status");

    if (passwordStatus) {

        passwordStatus.textContent = hasPassword
            ? "Change your password at any time."
            : "No password yet. You sign in with Google.";

    }

    if (openBtn) {

        openBtn.textContent = hasPassword ? "Change" : "Set password";

    }

    if (googleStatus) {

        googleStatus.textContent = hasGoogle
            ? "Linked. You can use Continue with Google to log in."
            : "Not linked. Sign in once with Google using this same email to link it.";

    }

    updateVerificationUi();

}


// ========================================
// EMAIL / PHONE VERIFICATION
// ========================================

function updateVerificationUi() {

    const rows = [
        {
            name: "email",
            statusEl: document.getElementById("email-verify-status"),
            button: document.getElementById("email-verify-btn"),
            have: Boolean(user.email),
            verified: Boolean(user.emailVerified),
            label: user.email,
            word: "Email"
        },
        {
            name: "phone",
            statusEl: document.getElementById("phone-verify-status"),
            button: document.getElementById("phone-verify-btn"),
            have: Boolean(user.mobile),
            verified: Boolean(user.mobileVerified),
            label: user.mobile,
            word: "Phone number"
        }
    ];

    rows.forEach(function (row) {

        if (!row.statusEl || !row.button) return;

        if (!row.have) {

            row.statusEl.textContent = "No phone number saved. Add one in Edit Profile.";
            row.button.classList.add("hidden");

        } else if (row.verified) {

            row.statusEl.textContent = row.word + " verified: " + row.label;
            row.statusEl.className = "text-sm text-green font-medium";
            row.button.classList.add("hidden");

        } else {

            row.statusEl.textContent = row.word + " not verified: " + row.label;
            row.statusEl.className = "text-sm text-slate-500 dark:text-slate-400";
            row.button.classList.remove("hidden");

        }

    });

}


let verifyChannel = "";
let verifyTimer = null;

function setVerifyStatus(text, isError) {

    const el = document.getElementById("verify-status");
    el.textContent = text || "";
    el.className = "text-sm mb-3 font-semibold " + (isError ? "text-red-500" : "text-green");

}

function startVerifyCountdown(seconds) {

    const btn = document.getElementById("verify-resend");
    clearInterval(verifyTimer);

    let left = seconds;

    function tick() {

        if (left > 0) {
            btn.disabled = true;
            btn.textContent = "Resend in " + left + "s";
            left--;
        } else {
            btn.disabled = false;
            btn.textContent = "Resend code";
            clearInterval(verifyTimer);
        }

    }

    tick();
    verifyTimer = setInterval(tick, 1000);

}

async function sendVerifyCode() {

    setVerifyStatus("Sending the code...", false);

    try {

        const response = await fetch(API_URL + "/account/verify/send", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ channel: verifyChannel })
        });

        if (response.status === 401) { clearSessionAndLeave(); return; }

        const data = await response.json();

        if (!response.ok) {
            setVerifyStatus(data.message || "Could not send the code.", true);
            startVerifyCountdown(data.resendIn || 0);
            return;
        }

        document.getElementById("verify-intro").textContent =
            data.message + " Enter it below. It works for 10 minutes.";
        setVerifyStatus("", false);
        startVerifyCountdown(data.resendIn || 60);

    } catch (error) {

        console.error("Send verify code error:", error);
        setVerifyStatus("Unable to connect to the CashBook server.", true);
        startVerifyCountdown(0);

    }

}

function openVerifyModal(channel) {

    verifyChannel = channel;

    const modal = document.getElementById("verify-modal");

    document.getElementById("verify-title").textContent =
        channel === "email" ? "Verify your email" : "Verify your phone number";
    document.getElementById("verify-intro").textContent = "";
    document.getElementById("verify-code").value = "";
    setVerifyStatus("", false);

    modal.classList.remove("hidden");
    modal.classList.add("flex");

    sendVerifyCode();

    document.getElementById("verify-code").focus();

}

function closeVerifyModal() {

    const modal = document.getElementById("verify-modal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    clearInterval(verifyTimer);

}

document.getElementById("verify-resend").addEventListener("click", sendVerifyCode);

document.getElementById("verify-code").addEventListener("input", function (event) {

    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 6);

});

document.getElementById("verify-form").addEventListener("submit", async function (event) {

    event.preventDefault();

    const code = document.getElementById("verify-code").value.trim();
    const submit = document.getElementById("verify-submit");

    if (!/^[0-9]{6}$/.test(code)) {
        setVerifyStatus("Enter the 6-digit code.", true);
        return;
    }

    submit.disabled = true;
    setVerifyStatus("Checking...", false);

    try {

        const response = await fetch(API_URL + "/account/verify/confirm", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ code: code })
        });

        if (response.status === 401) { clearSessionAndLeave(); return; }

        const data = await response.json();

        if (!response.ok) {
            setVerifyStatus(data.message || "That code did not work.", true);
            return;
        }

        saveUser(data.user);
        updateVerificationUi();
        setVerifyStatus(data.message, false);

        setTimeout(closeVerifyModal, 900);

    } catch (error) {

        console.error("Confirm verify code error:", error);
        setVerifyStatus("Unable to connect to the CashBook server.", true);

    } finally {

        submit.disabled = false;

    }

});


updateSecurityUi();


// Ask the server for the latest copy of this account
async function refreshFromServer() {

    try {

        const response = await fetch(
            API_URL + "/account/me",
            { headers: authHeaders() }
        );

        if (response.status === 401) {

            clearSessionAndLeave();

            return;

        }

        if (!response.ok) return;

        const data = await response.json();

        saveUser(data.user);

        displayUser();

        updateSecurityUi();

        // Show the Google photo if the account has one
        if (window.cashbookApplyPhoto) {

            window.cashbookApplyPhoto();

        }

    } catch (error) {

        console.error("Refresh account error:", error);

    }

}


refreshFromServer();


// ========================================
// CHANGE PASSWORD MODAL
// ========================================

const passwordModal =
    document.getElementById("password-modal");

const passwordForm =
    document.getElementById("password-form");


function openPasswordModal() {

    const hasPassword = user.hasPassword !== false;

    passwordForm.reset();

    showStatus("password-form-status", "", false);

    document.getElementById("current-password-wrap")
        .classList.toggle("hidden", !hasPassword);

    document.getElementById("forgot-current-wrap")
        .classList.toggle("hidden", !hasPassword);

    document.getElementById("password-set-note")
        .classList.toggle("hidden", hasPassword);

    document.getElementById("password-title").textContent =
        hasPassword ? "Change Password" : "Set Password";

    passwordModal.classList.remove("hidden");

    passwordModal.classList.add("flex");

}


function closePasswordModal() {

    passwordModal.classList.add("hidden");

    passwordModal.classList.remove("flex");

}


passwordForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();

        const hasPassword = user.hasPassword !== false;

        const currentPassword =
            document.getElementById("current-password").value;

        const newPassword =
            document.getElementById("new-password").value;

        const confirmPassword =
            document.getElementById("confirm-password").value;

        const submitBtn =
            document.getElementById("password-submit");

        if (hasPassword && !currentPassword) {

            showStatus("password-form-status", "Please enter your current password.", true);

            return;

        }

        if (newPassword.length < 6) {

            showStatus("password-form-status", "New password must be at least 6 characters.", true);

            return;

        }

        if (newPassword !== confirmPassword) {

            showStatus("password-form-status", "The two new passwords do not match.", true);

            return;

        }

        submitBtn.disabled = true;

        try {

            const response = await fetch(
                API_URL + "/account/change-password",
                {
                    method: "PUT",
                    headers: authHeaders(),
                    body: JSON.stringify({
                        currentPassword: currentPassword,
                        newPassword: newPassword
                    })
                }
            );

            const data = await response.json();

            if (response.status === 401) {

                clearSessionAndLeave();

                return;

            }

            if (!response.ok) {

                showStatus(
                    "password-form-status",
                    data.message || "Unable to change your password.",
                    true
                );

                return;

            }

            saveUser(data.user);

            updateSecurityUi();

            closePasswordModal();

            alert(data.message || "Password changed successfully.");

        } catch (error) {

            console.error("Change password error:", error);

            showStatus(
                "password-form-status",
                "Unable to connect to the CashBook server.",
                true
            );

        } finally {

            submitBtn.disabled = false;

        }

    }
);


// ========================================
// EMAIL A RESET LINK  (if the current password is forgotten)
// ========================================

async function sendPasswordReset() {

    if (!user.email) {

        showStatus("password-form-status", "No email address is associated with this account.", true);

        return;

    }

    try {

        const response = await fetch(
            API_URL + "/auth/forgot-password",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: user.email })
            }
        );

        const data = await response.json();

        showStatus(
            "password-form-status",
            data.message || "Request sent.",
            !response.ok
        );

    } catch (error) {

        console.error("Password reset error:", error);

        showStatus(
            "password-form-status",
            "Unable to connect to the CashBook server.",
            true
        );

    }

}


// ========================================
// EXPORT TRANSACTIONS TO CSV
// ========================================

// A cell that starts with = + - @ could run as a formula in Excel,
// so it is prefixed with an apostrophe. Quotes are doubled.
function csvCell(value) {

    let text = String(value === undefined || value === null ? "" : value);

    if (/^[=+\-@\t\r]/.test(text)) {

        text = "'" + text;

    }

    return '"' + text.replace(/"/g, '""') + '"';

}


async function exportTransactionsCsv() {

    const button = document.getElementById("export-btn");

    showStatus("export-status", "", false);

    button.disabled = true;

    try {

        const response = await fetch(
            API_URL + "/transactions",
            { headers: authHeaders() }
        );

        const data = await response.json();

        if (response.status === 401) {

            clearSessionAndLeave();

            return;

        }

        if (!response.ok) {

            showStatus("export-status", data.message || "Unable to load your transactions.", true);

            return;

        }

        const list = data.transactions || [];

        if (!list.length) {

            showStatus("export-status", "You have no transactions to export yet.", true);

            return;

        }

        const rows = [
            ["Date", "Time", "Type", "Category", "Description", "Amount"]
        ];

        list.forEach(function (t) {

            rows.push([t.date, t.time, t.type, t.category, t.description, t.amount]);

        });

        const csv =
            "\uFEFF" +
            rows.map(function (row) {
                return row.map(csvCell).join(",");
            }).join("\r\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });

        const link = document.createElement("a");

        link.href = URL.createObjectURL(blob);

        link.download = "cashbook-transactions.csv";

        document.body.appendChild(link);

        link.click();

        link.remove();

        setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);

        showStatus("export-status", list.length + " transactions exported.", false);

    } catch (error) {

        console.error("Export error:", error);

        showStatus("export-status", "Unable to connect to the CashBook server.", true);

    } finally {

        button.disabled = false;

    }

}


// ========================================
// DELETE ACCOUNT
// ========================================

const deleteModal =
    document.getElementById("delete-modal");

const deleteForm =
    document.getElementById("delete-form");


function openDeleteModal() {

    deleteForm.reset();

    showStatus("delete-form-status", "", false);

    document.getElementById("delete-password-wrap")
        .classList.toggle("hidden", user.hasPassword === false);

    deleteModal.classList.remove("hidden");

    deleteModal.classList.add("flex");

}


function closeDeleteModal() {

    deleteModal.classList.add("hidden");

    deleteModal.classList.remove("flex");

}


deleteForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();

        const confirmText =
            document.getElementById("delete-confirm").value.trim();

        const password =
            document.getElementById("delete-password").value;

        const submitBtn =
            document.getElementById("delete-submit");

        if (confirmText !== "DELETE") {

            showStatus("delete-form-status", "Type DELETE in capital letters to confirm.", true);

            return;

        }

        if (user.hasPassword !== false && !password) {

            showStatus("delete-form-status", "Please enter your password.", true);

            return;

        }

        submitBtn.disabled = true;

        try {

            const response = await fetch(
                API_URL + "/account",
                {
                    method: "DELETE",
                    headers: authHeaders(),
                    body: JSON.stringify({
                        confirm: confirmText,
                        password: password
                    })
                }
            );

            const data = await response.json();

            if (response.status === 401) {

                clearSessionAndLeave();

                return;

            }

            if (!response.ok) {

                showStatus(
                    "delete-form-status",
                    data.message || "Unable to delete your account.",
                    true
                );

                return;

            }

            alert(data.message || "Your account has been deleted.");

            clearSessionAndLeave();

        } catch (error) {

            console.error("Delete account error:", error);

            showStatus(
                "delete-form-status",
                "Unable to connect to the CashBook server.",
                true
            );

        } finally {

            submitBtn.disabled = false;

        }

    }
);


// ========================================
// LOGOUT
// ========================================

function logout() {

    clearSessionAndLeave();

}
