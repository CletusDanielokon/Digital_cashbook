// pwa.js - makes CashBook installable ("Add to Home screen") and registers the service worker.
(function () {
    "use strict";

    // 1. Register the service worker (needs https, or localhost while testing)
    var secure = window.location.protocol === "https:" ||
        window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

    if ("serviceWorker" in navigator && secure) {
        window.addEventListener("load", function () {
            navigator.serviceWorker.register("sw.js").catch(function (error) {
                console.warn("Service worker not registered:", error.message);
            });
        });
    }

    // 2. "Install app" button in the side menu (Chrome / Edge / Android offer it)
    var installEvent = null;

    function alreadyInstalled() {
        return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
            window.navigator.standalone === true;
    }

    function removeButton() {
        var button = document.getElementById("install-link");
        if (button && button.parentNode) button.parentNode.removeChild(button);
    }

    function addButton() {
        var nav = document.querySelector("#sidebar nav");
        if (!nav || document.getElementById("install-link") || alreadyInstalled()) return;

        var button = document.createElement("button");
        button.id = "install-link";
        button.type = "button";
        button.className = "menu-link";
        button.innerHTML = '<i class="fa-solid fa-download"></i><span>Install app</span>';

        button.addEventListener("click", function () {
            if (!installEvent) return;
            installEvent.prompt();
            installEvent.userChoice.then(function () {
                installEvent = null;
                removeButton();
            });
        });

        nav.appendChild(button);
    }

    window.addEventListener("beforeinstallprompt", function (event) {
        event.preventDefault();          // keep it for our own button
        installEvent = event;
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addButton);
        else addButton();
    });

    window.addEventListener("appinstalled", function () {
        installEvent = null;
        removeButton();
    });
})();
