document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    // =========================================
    // 1. CHECK USER LOGIN
    // =========================================
    const user = JSON.parse(localStorage.getItem("cashbookUser")) || null;

    if (!user) {
        window.location.href = "index.html";
        return;
    }

    // =========================================
    // 2. GET USER INFORMATION
    // =========================================
    const fullName = user.fullName || user.name || user.username || "CashBook User";
    const email = user.email || "No email available";
    const mobile = user.mobile || user.phone || user.phoneNumber || "Not provided";
    const bookName = user.book || user.bookName || "My Personal CashBook";
    const currency = user.currency || "NGN (₦)";
    const joinedDate = user.createdAt || "January 2026";

    // =========================================
    // 3. GET USER INITIALS
    // =========================================
    const names = fullName.trim().split(/\s+/);
    let initials = names[0].charAt(0).toUpperCase();

    if (names.length > 1) {
        initials += names[names.length - 1].charAt(0).toUpperCase();
    }

    // =========================================
    // 4. PROFILE ELEMENTS
    // =========================================
    const profileInitials = document.getElementById("profile-initials");
    const profileHeaderInitials = document.getElementById("profileHeaderInitials");
    const sidebarUserName = document.getElementById("sidebar-user-name");
    const headerUserName = document.getElementById("header-user-name");
    const profileAvatar = document.getElementById("profile-avatar");
    const profileFullName = document.getElementById("profile-full-name");
    const profileEmail = document.getElementById("profile-email");

    const infoFullName = document.getElementById("info-full-name");
    const infoEmail = document.getElementById("info-email");
    const infoMobile = document.getElementById("info-mobile");
    const infoBookName = document.getElementById("info-book-name");
    const infoCurrency = document.getElementById("info-currency");
    const infoJoinedDate = document.getElementById("info-joined-date");

    // =========================================
    // 5. DISPLAY USER INFORMATION
    // =========================================
    if (profileInitials) profileInitials.textContent = initials;
    if (profileHeaderInitials) profileHeaderInitials.textContent = initials;
    if (sidebarUserName) sidebarUserName.textContent = names[0];
    if (headerUserName) headerUserName.textContent = names[0];
    if (profileAvatar) profileAvatar.textContent = initials;
    if (profileFullName) profileFullName.textContent = fullName;
    if (profileEmail) profileEmail.textContent = email;

    if (infoFullName) infoFullName.textContent = fullName;
    if (infoEmail) infoEmail.textContent = email;
    if (infoMobile) infoMobile.textContent = mobile;
    if (infoBookName) infoBookName.textContent = bookName;
    if (infoCurrency) infoCurrency.textContent = currency;
    if (infoJoinedDate) infoJoinedDate.textContent = joinedDate;

    // =========================================
    // 6. NAVIGATION
    // =========================================
    document.getElementById("dashboard-link")?.addEventListener("click", function () {
        window.location.href = "dashboard.html";
    });

    document.getElementById("transactions-link")?.addEventListener("click", function () {
        window.location.href = "transactions.html";
    });

    document.getElementById("budget-link")?.addEventListener("click", function () {
        window.location.href = "budget.html";
    });

    document.getElementById("debts-link")?.addEventListener("click", function () {
        window.location.href = "debts.html";
    });

    document.getElementById("reports-link")?.addEventListener("click", function () {
        window.location.href = "reports.html";
    });

    document.getElementById("profile-link")?.addEventListener("click", function () {
        window.location.href = "profile.html";
    });

    document.getElementById("settings-link")?.addEventListener("click", function () {
        window.location.href = "settings.html";
    });

    // =========================================
    // 7. LOGOUT
    // =========================================
    document.getElementById("logout-link")?.addEventListener("click", function () {
        const confirmLogout = confirm("Are you sure you want to logout?");
        if (confirmLogout) {
            localStorage.removeItem("cashbookUser");
            localStorage.removeItem("cashbookToken");
            window.location.href = "index.html";
        }
    });
});