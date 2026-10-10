document.addEventListener("DOMContentLoaded", function () {
    // 1. Fetch saved user details from localStorage
    const user = JSON.parse(localStorage.getItem("cashbookUser"));

    // If no user exists, redirect to login page
    if (!user || !user.fullName) {
        window.location.href = "index.html";
        return;
    }

    // 2. Select DOM elements
    const profileInitials = document.getElementById("profile-initials");
    const profileHeaderInitials = document.getElementById("profile-initials-header");
    const userName = document.getElementById("user-name");
    const userNameHeader = document.getElementById("user-name-header");
    const welcomeName = document.getElementById("welcome-name");

    // 3. Process full name into first name & initials
    const fullName = user.fullName.trim();
    const names = fullName.split(/\s+/);
    const firstName = names[0];

    let initials = names[0].charAt(0).toUpperCase();
    if (names.length > 1) {
        initials += names[names.length - 1].charAt(0).toUpperCase();
    }

    // 4. Update UI elements safely
    if (profileInitials) profileInitials.textContent = initials;
    if (profileHeaderInitials) profileHeaderInitials.textContent = initials;
    if (userName) userName.textContent = firstName;
    if (userNameHeader) userNameHeader.textContent = firstName;
    if (welcomeName) welcomeName.textContent = firstName;

    // 5. Navigation event listeners
    const routes = [
        { id: "dashboard-link", target: "dashboard.html" },
        { id: "go-dashboard", target: "dashboard.html" },
        { id: "transactions-link", target: "transactions.html" },
        { id: "budget-link", target: "budget.html" },
        { id: "reports-link", target: "reports.html" },
        { id: "profile-link", target: "profile.html" },
        { id: "settings-link", target: "settings.html" }
    ];

    routes.forEach(route => {
        const btn = document.getElementById(route.id);
        if (btn) {
            btn.addEventListener("click", function () {
                window.location.href = route.target;
            });
        }
    });

    // 6. Logout event listener
    const logoutBtn = document.getElementById("logout-link");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", function () {
            if (confirm("Are you sure you want to logout?")) {
                localStorage.removeItem("cashbookUser");
                localStorage.removeItem("cashbookToken");
                window.location.href = "index.html";
            }
        });
    }
});