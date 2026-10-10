import { auth, db, ADMIN_UID } from "./firebase.js";
import { formatListingDateTime } from "./listing-date.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
    doc,
    getDoc,
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


/* =========================
   ELEMENTS
========================= */

const welcomeMessage =
    document.getElementById("welcomeMessage");

const uploadBtn =
    document.getElementById("uploadBtn");

const bottomUploadBtn =
    document.getElementById("bottomUploadBtn");

const logoutBtn =
    document.getElementById("logoutBtn");

const themeBtn =
    document.getElementById("themeBtn");

const searchInput =
    document.getElementById("searchInput");

const searchBtn =
    document.getElementById("searchBtn");

const materialsList =
    document.getElementById("materialsList");

const listingCount =
    document.querySelector(".listing-count");

const adminLink =
    document.getElementById("adminLink");


/* =========================
   ACCOUNT
========================= */

const accountMenu =
    document.getElementById("accountMenu");

const accountBtn =
    document.getElementById("accountBtn");

const accountDropdown =
    document.getElementById("accountDropdown");

const accountName =
    document.getElementById("accountName");

const dropdownUserName =
    document.getElementById("dropdownUserName");

const dropdownUserEmail =
    document.getElementById("dropdownUserEmail");

const accountEmail =
    document.getElementById("accountEmail");

const dropdownLogoutBtn =
    document.getElementById("dropdownLogoutBtn");


/* =========================
   DATA
========================= */

let allMaterials = [];

let currentUser = null;


/* =========================
   AUTH
========================= */

onAuthStateChanged(auth, async function (user) {

    if (!user) {

        window.location.href = "index.html";

        return;
    }


    currentUser = user;

    if (adminLink) {

        adminLink.hidden =
            user.uid !== ADMIN_UID;

    }


    /* =========================
       ACCOUNT DETAILS
    ========================= */

    const userEmail =
        user.email || "Email not available";


    if (accountEmail) {

        accountEmail.textContent =
            userEmail;

    }


    if (dropdownUserEmail) {

        dropdownUserEmail.textContent =
            userEmail;

    }


    if (accountName) {

        accountName.textContent =
            "Account";

    }


    if (dropdownUserName) {

        dropdownUserName.textContent =
            "Student";

    }


    /* =========================
       LOAD USER PROFILE
    ========================= */

    try {

        const userDoc =
            await getDoc(
                doc(
                    db,
                    "users",
                    user.uid
                )
            );


        if (userDoc.exists()) {

            const userData =
                userDoc.data();


            const displayName =
                userData.name || "Student";


            /* ACCOUNT NAME */

            if (accountName) {

                accountName.textContent =
                    displayName;

            }


            /* DROPDOWN NAME */

            if (dropdownUserName) {

                dropdownUserName.textContent =
                    displayName;

            }


            /* WELCOME MESSAGE */

            if (welcomeMessage) {

                welcomeMessage.textContent =
                    "Welcome, " +
                    displayName +
                    "!";

            }

        } else {

            if (welcomeMessage) {

                welcomeMessage.textContent =
                    "Welcome!";

            }

        }


    } catch (error) {

        console.error(
            "User loading error:",
            error
        );


        if (welcomeMessage) {

            welcomeMessage.textContent =
                "Welcome!";

        }

    }


    /* LOAD MATERIALS */

    await loadMaterials();

});


/* =========================
   UPLOAD BUTTONS
========================= */

function openUploadPage() {

    window.location.href =
        "upload.html";

}


if (uploadBtn) {

    uploadBtn.addEventListener(
        "click",
        openUploadPage
    );

}


if (bottomUploadBtn) {

    bottomUploadBtn.addEventListener(
        "click",
        openUploadPage
    );

}


/* =========================
   ACCOUNT DROPDOWN
========================= */

if (
    accountBtn &&
    accountDropdown
) {

    accountBtn.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            event.stopPropagation();


            accountDropdown.classList.toggle(
                "show"
            );

        }
    );

}


/* =========================
   CLOSE ACCOUNT DROPDOWN
========================= */

document.addEventListener(
    "click",
    function (event) {

        if (
            accountMenu &&
            accountDropdown &&
            !accountMenu.contains(
                event.target
            )
        ) {

            accountDropdown.classList.remove(
                "show"
            );

        }

    }
);


/* =========================
   DROPDOWN LOGOUT
========================= */

if (dropdownLogoutBtn) {

    dropdownLogoutBtn.addEventListener(
        "click",
        async function () {

            try {

                await signOut(auth);


                window.location.href =
                    "index.html";


            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );


                alert(
                    "Logout failed: " +
                    error.message
                );

            }

        }
    );

}


/* =========================
   LOGOUT
========================= */

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        async function () {

            try {

                await signOut(auth);


                window.location.href =
                    "index.html";


            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );


                alert(
                    "Logout failed: " +
                    error.message
                );

            }

        }
    );

}


/* =========================
   DARK MODE
========================= */

function applyTheme() {

    const savedTheme =
        localStorage.getItem(
            "bookSahayakTheme"
        );


    const isDark =
        savedTheme === "dark";


    document.body.classList.toggle(
        "dark-mode",
        isDark
    );


    if (themeBtn) {

        themeBtn.textContent =
            isDark
                ? "☀️ Light Mode"
                : "🌙 Dark Mode";

    }

}


applyTheme();


if (themeBtn) {

    themeBtn.addEventListener(
        "click",
        function () {

            const isDark =
                !document.body.classList.contains(
                    "dark-mode"
                );


            document.body.classList.toggle(
                "dark-mode",
                isDark
            );


            localStorage.setItem(
                "bookSahayakTheme",
                isDark
                    ? "dark"
                    : "light"
            );


            themeBtn.textContent =
                isDark
                    ? "☀️ Light Mode"
                    : "🌙 Dark Mode";

        }
    );

}


/* =========================
   LOAD MATERIALS
========================= */

async function loadMaterials() {

    if (!materialsList) {

        return;

    }


    try {

        materialsList.innerHTML =
            "<div class=\"loading-card\">" +
                "<div class=\"loading-icon\">📚</div>" +
                "<h3>Loading resources...</h3>" +
                "<p>Finding the latest resources for you.</p>" +
            "</div>";


        const snapshot =
            await getDocs(
                query(
                    collection(db, "materials"),
                    where("status", "==", "approved")
                )
            );


        allMaterials = [];


        snapshot.forEach(
            function (docSnapshot) {

                const material =
                    docSnapshot.data();

                allMaterials.push({

                    id: docSnapshot.id,

                    ...material

                });

            }
        );


        /* =========================
           YOUR LISTINGS FIRST
        ========================= */

        allMaterials.sort(
            function (a, b) {

                const aIsMine =
                    currentUser &&
                    a.uploadedBy ===
                    currentUser.uid;


                const bIsMine =
                    currentUser &&
                    b.uploadedBy ===
                    currentUser.uid;


                return (
                    Number(bIsMine) -
                    Number(aIsMine)
                );

            }
        );


        renderMaterials(
            allMaterials
        );


    } catch (error) {

        console.error(
            "Materials loading error:",
            error
        );


        materialsList.innerHTML =
            "<div class=\"no-results-card\">" +
                "<div class=\"no-results-icon\">⚠️</div>" +
                "<h3>Could not load resources</h3>" +
                "<p>" +
                    escapeHTML(
                        error.message
                    ) +
                "</p>" +
            "</div>";

    }

}


/* =========================
   RENDER MATERIALS
========================= */

function renderMaterials(materials) {

    if (!materialsList) {

        return;

    }


    materialsList.innerHTML = "";


    updateSearchStatus(
        materials.length
    );


    /* =========================
       NO RESULTS
    ========================= */

    if (materials.length === 0) {

        const searchText =
            searchInput
                ? searchInput.value.trim()
                : "";


        if (searchText) {

            const noResultsDiv =
                document.createElement(
                    "div"
                );


            noResultsDiv.className =
                "no-results-card";


            noResultsDiv.innerHTML =
                "<div class=\"no-results-icon\">🔍</div>" +
                "<h3>No results found</h3>" +
                "<p>Nothing matches " +
                "<strong>" +
                    escapeHTML(
                        searchText
                    ) +
                "</strong></p>" +
                "<button " +
                    "type=\"button\" " +
                    "class=\"clear-search-btn\" " +
                    "id=\"clearSearchBtn\">" +
                    "Clear Search" +
                "</button>";


            materialsList.appendChild(
                noResultsDiv
            );


            const clearSearchBtn =
                document.getElementById(
                    "clearSearchBtn"
                );


            if (clearSearchBtn) {

                clearSearchBtn.addEventListener(
                    "click",
                    clearSearch
                );

            }


        } else {

            const emptyDiv =
                document.createElement(
                    "div"
                );


            emptyDiv.className =
                "no-results-card";


            emptyDiv.innerHTML =
                "<div class=\"no-results-icon\">📚</div>" +
                "<h3>No resources yet</h3>" +
                "<p>Be the first student to list a resource.</p>";


            materialsList.appendChild(
                emptyDiv
            );

        }


        return;

    }


    /* =========================
       CREATE MATERIAL CARDS
    ========================= */

    materials.forEach(
        function (material) {

            const materialDiv =
                document.createElement(
                    "div"
                );


            materialDiv.className =
                "resource-card";


            const category =
                material.category ||
                "Resource";


            const title =
                material.title ||
                "Untitled Resource";


            const subject =
                material.subject ||
                "Study Material";


            const description =
                material.description ||
                "No description available.";


            const condition =
                material.condition ||
                "Digital";


            const uploader =
                material.uploaderName ||
                "Student";


            /* =========================
               PRICE
            ========================= */

            let price = "FREE";


            if (
                !material.isFree &&
                material.price !== undefined &&
                material.price !== null &&
                material.price !== ""
            ) {

                price =
                    "₹" +
                    material.price;

            }


            /* =========================
               SELLER / OWNER LABEL
            ========================= */

            let sellerText;


            if (
                currentUser &&
                material.uploadedBy ===
                currentUser.uid
            ) {

                sellerText =
                    "🟢 Uploaded by you";

            } else {

                sellerText =
                    "👤 " +
                    uploader;

            }


            /* =========================
               CARD HTML
            ========================= */

            materialDiv.innerHTML =
    "<div class=\"resource-card-top\">" +

        "<span class=\"resource-category\">" +
            escapeHTML(category) +
        "</span>" +

        "<span class=\"resource-price " +
            (material.isFree ? "free-price" : "paid-price") +
        "\">" +

            (material.isFree
                ? "✓ FREE"
                : "₹" + escapeHTML(String(material.price))
            ) +

        "</span>" +

    "</div>" +


    "<div class=\"resource-icon-wrapper\">" +

        "<div class=\"resource-icon\">" +
            getCategoryIcon(category) +
        "</div>" +

    "</div>" +


    "<h3 class=\"resource-title\">" +
        escapeHTML(title) +
    "</h3>" +


    "<p class=\"resource-subject\">" +
        "📖 " +
        escapeHTML(subject) +
    "</p>" +


    "<p class=\"resource-posted\">" +
        "🕒 Posted " +
        escapeHTML(formatListingDateTime(material.createdAt)) +
    "</p>" +

        "<p class=\"resource-description\">" +
        escapeHTML(description) +
    "</p>" +


    "<div class=\"resource-meta\">" +

        "<span>" +
            "📦 " +
            escapeHTML(condition) +
        "</span>" +

        "<span>" +
            escapeHTML(sellerText) +
        "</span>" +

    "</div>" +


    "<div class=\"resource-card-footer\">" +

        "<button " +
            "type=\"button\" " +
            "class=\"viewMaterialBtn\">" +

            "View Details" +

            "<span>→</span>" +

        "</button>" +

    "</div>";


            /* =========================
               VIEW DETAILS
            ========================= */

            const viewButton =
                materialDiv.querySelector(
                    ".viewMaterialBtn"
                );


            if (viewButton) {

                viewButton.addEventListener(
                    "click",
                    function () {

                        window.location.href =
                            "material.html?id=" +
                            encodeURIComponent(
                                material.id
                            );

                    }
                );

            }


            materialsList.appendChild(
                materialDiv
            );

        }
    );

}


/* =========================
   SEARCH
========================= */

if (searchInput) {

    searchInput.addEventListener(
        "input",
        performSearch
    );


    searchInput.addEventListener(
        "search",
        performSearch
    );


    searchInput.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

                performSearch();

            }

        }
    );

}


if (searchBtn) {

    searchBtn.addEventListener(
        "click",
        performSearch
    );

}


/* =========================
   SEARCH FUNCTION
========================= */

function performSearch() {

    if (!searchInput) {

        return;

    }


    const searchText =
        searchInput.value
            .toLowerCase()
            .trim();


    if (!searchText) {

        renderMaterials(
            allMaterials
        );

        return;

    }


    const words =
        searchText
            .split(/\s+/)
            .filter(Boolean);


    const filtered =
        allMaterials.filter(
            function (material) {

                const searchableText = [

                    material.title,

                    material.category,

                    material.subject,

                    material.description,

                    material.uploaderName,

                    material.condition,

                    material.price,

                    material.isFree
                        ? "free"
                        : ""

                ]
                    .filter(
                        function (value) {

                            return (
                                value !== undefined &&
                                value !== null
                            );

                        }
                    )
                    .join(" ")
                    .toLowerCase();


                return words.every(
                    function (word) {

                        return searchableText.includes(
                            word
                        );

                    }
                );

            }
        );


    renderMaterials(
        filtered
    );

}


/* =========================
   CLEAR SEARCH
========================= */

function clearSearch() {

    if (!searchInput) {

        return;

    }


    searchInput.value = "";


    renderMaterials(
        allMaterials
    );


    searchInput.focus();

}


/* =========================
   SEARCH RESULT COUNT
========================= */

function updateSearchStatus(count) {

    if (!listingCount) {

        return;

    }


    const searchText =
        searchInput
            ? searchInput.value.trim()
            : "";


    if (!searchText) {

        listingCount.textContent =
            "Recently added";

        return;

    }


    listingCount.textContent =
        count +
        (
            count === 1
                ? " result found"
                : " results found"
        );

}


/* =========================
   CATEGORY ICON
========================= */

function getCategoryIcon(category) {

    const value =
        String(category)
            .toLowerCase();


    if (
        value.includes("book")
    ) {

        return "📚";

    }


    if (
        value.includes("note")
    ) {

        return "📝";

    }


    if (
        value.includes("pyq")
    ) {

        return "📄";

    }


    if (
        value.includes("lab")
    ) {

        return "💻";

    }


    return "🎓";

}


/* =========================
   HTML SAFETY
========================= */

function escapeHTML(value) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}
