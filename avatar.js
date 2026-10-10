// =====================================================
// avatar.js
// If the user signed in with Google, show their Google
// profile photo instead of their initials. Runs on every
// page after that page's own script. Without a photo it
// does nothing, so initials stay as they are.
// =====================================================
(function () {
    "use strict";

    var IDS = [
        "sidebar-initials", "header-initials", "profile-initials",
        "profileHeaderInitials", "top-profile-initials",
        "profile-initials-header", "profile-avatar", "settings-avatar"
    ];

    function applyPhoto() {
        var user = null;

        try {
            user = JSON.parse(localStorage.getItem("cashbookUser"));
        } catch (e) {
            return;
        }

        if (!user || !user.picture || !/^https:\/\//i.test(user.picture)) return;

        IDS.forEach(function (id) {
            var box = document.getElementById(id);

            if (!box || box.querySelector("img.cb-photo")) return;

            var initials = box.textContent;
            var img = document.createElement("img");

            img.className = "cb-photo w-full h-full rounded-full object-cover";
            img.alt = "";
            img.referrerPolicy = "no-referrer";
            img.src = user.picture;

            // If the photo cannot load, go back to the initials
            img.addEventListener("error", function () {
                box.textContent = initials;
            });

            box.textContent = "";
            box.classList.add("overflow-hidden");
            box.appendChild(img);
        });
    }

    // Other scripts can call this after they update the user
    window.cashbookApplyPhoto = applyPhoto;

    applyPhoto();
    document.addEventListener("DOMContentLoaded", applyPhoto);
    window.addEventListener("load", applyPhoto);
})();
