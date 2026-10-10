import { auth, db } from "./firebase.js";
import { formatListingDateTime } from "./listing-date.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


/* =========================
   ELEMENTS
========================= */

const searchInput =
    document.getElementById(
        "fullSearchInput"
    );


const clearButton =
    document.getElementById(
        "clearSearchPage"
    );


const searchResults =
    document.getElementById(
        "searchResults"
    );


const searchResultsTitle =
    document.getElementById(
        "searchResultsTitle"
    );


const searchResultsCount =
    document.getElementById(
        "searchResultsCount"
    );


const popularSection =
    document.getElementById(
        "popularSection"
    );


const recentSearchSection =
    document.getElementById(
        "recentSearchSection"
    );


const recentSearchList =
    document.getElementById(
        "recentSearchList"
    );


const backButton =
    document.getElementById(
        "backSearchBtn"
    );


/* =========================
   DATA
========================= */

let allMaterials = [];

let currentUser = null;


/* =========================
   AUTH
========================= */

onAuthStateChanged(
    auth,
    async function (user) {

        if (!user) {

            window.location.href =
                "index.html";

            return;

        }


        currentUser = user;


        await loadMaterials();


        loadRecentSearches();


        /* URL SEARCH */

        const params =
            new URLSearchParams(
                window.location.search
            );


        const query =
            params.get("q");


        if (query) {

            searchInput.value =
                query;

            performSearch();

            saveRecentSearch(
                query
            );

        }


        searchInput.focus();

    }
);


/* =========================
   LOAD MATERIALS
========================= */

async function loadMaterials() {

    try {

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

                    id:
                        docSnapshot.id,

                    ...material

                });

            }
        );


    } catch (error) {

        console.error(
            "Search materials error:",
            error
        );


        searchResults.innerHTML =

            "<div class=\"search-empty-state\">" +

                "<div class=\"search-empty-icon\">⚠️</div>" +

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
   SEARCH
========================= */

if (searchInput) {

    searchInput.addEventListener(
        "input",
        function () {

            performSearch();

        }
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

                const value =
                    searchInput.value.trim();


                if (value) {

                    saveRecentSearch(
                        value
                    );

                }

            }


            if (
                event.key ===
                "Escape"
            ) {

                goBack();

            }

        }
    );

}


/* =========================
   SEARCH FUNCTION
========================= */

function performSearch() {

    const searchText =
        searchInput.value
            .toLowerCase()
            .trim();


    if (!searchText) {

        showEmptyState();

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


    renderResults(
        filtered,
        searchText
    );

}


/* =========================
   RENDER RESULTS
========================= */

function renderResults(
    materials,
    searchText
) {

    popularSection.classList.add(
        "search-hidden"
    );


    searchResultsTitle.textContent =
        "Results for \"" +
        searchText +
        "\"";


    searchResultsCount.textContent =
        materials.length +
        (
            materials.length === 1
                ? " result"
                : " results"
        );


    searchResults.innerHTML =
        "";


    if (
        materials.length === 0
    ) {

        searchResults.innerHTML =

            "<div class=\"search-empty-state\">" +

                "<div class=\"search-empty-icon\">📚</div>" +

                "<h3>No resources found</h3>" +

                "<p>" +
                    "We couldn't find anything matching \"" +
                    escapeHTML(
                        searchText
                    ) +
                    "\"." +
                "</p>" +

                "<span>" +
                    "Try another subject, book name or keyword." +
                "</span>" +

            "</div>";

        return;

    }


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


            /* PRICE */

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


            /* OWNER */

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


            /* CARD */

            materialDiv.innerHTML =

                "<div class=\"resource-card-top\">" +

                    "<span class=\"resource-category\">" +
                        escapeHTML(
                            category
                        ) +
                    "</span>" +

                    "<span class=\"resource-price\">" +
                        escapeHTML(
                            String(price)
                        ) +
                    "</span>" +

                "</div>" +


                "<div class=\"resource-icon\">" +
                    getCategoryIcon(
                        category
                    ) +
                "</div>" +


                "<h3>" +
                    escapeHTML(
                        title
                    ) +
                "</h3>" +


                "<p class=\"resource-subject\">" +
                    "📖 " +
                    escapeHTML(
                        subject
                    ) +
                "</p>" +


                "<p class=\"resource-posted\">" +
                    "🕒 Posted " +
                    escapeHTML(formatListingDateTime(material.createdAt)) +
                "</p>" +

                                "<p class=\"resource-description\">" +
                    escapeHTML(
                        description
                    ) +
                "</p>" +


                "<div class=\"resource-meta\">" +

                    "<span>" +
                        escapeHTML(
                            condition
                        ) +
                    "</span>" +

                    "<span>" +
                        escapeHTML(
                            sellerText
                        ) +
                    "</span>" +

                "</div>" +


                "<button " +
                    "type=\"button\" " +
                    "class=\"viewMaterialBtn\">" +
                    "View Details →" +
                "</button>";


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


            searchResults.appendChild(
                materialDiv
            );

        }
    );

}


/* =========================
   EMPTY SEARCH
========================= */

function showEmptyState() {

    popularSection.classList.remove(
        "search-hidden"
    );


    searchResultsTitle.textContent =
        "Search for a resource";


    searchResultsCount.textContent =
        "0 results";


    searchResults.innerHTML =

        "<div class=\"search-empty-state\">" +

            "<div class=\"search-empty-icon\">🔎</div>" +

            "<h3>Start searching</h3>" +

            "<p>" +
                "Type something above to find study materials." +
            "</p>" +

        "</div>";

}


/* =========================
   CLEAR SEARCH
========================= */

if (clearButton) {

    clearButton.addEventListener(
        "click",
        function () {

            searchInput.value = "";

            searchInput.focus();

            showEmptyState();

        }
    );

}


/* =========================
   POPULAR SEARCH BUTTONS
========================= */

document
    .querySelectorAll(
        ".search-chip"
    )
    .forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    const value =
                        button.dataset.search;


                    searchInput.value =
                        value;


                    performSearch();


                    saveRecentSearch(
                        value
                    );


                    searchInput.focus();

                }
            );

        }
    );


/* =========================
   RECENT SEARCHES
========================= */

function saveRecentSearch(
    value
) {

    const search =
        value.trim();


    if (!search) {

        return;

    }


    let recent =
        JSON.parse(
            localStorage.getItem(
                "bookSahayakRecentSearches"
            ) || "[]"
        );


    recent =
        recent.filter(
            function (item) {

                return (
                    item.toLowerCase() !==
                    search.toLowerCase()
                );

            }
        );


    recent.unshift(
        search
    );


    recent =
        recent.slice(
            0,
            5
        );


    localStorage.setItem(
        "bookSahayakRecentSearches",
        JSON.stringify(
            recent
        )
    );


    loadRecentSearches();

}


/* =========================
   LOAD RECENT SEARCHES
========================= */

function loadRecentSearches() {

    const recent =
        JSON.parse(
            localStorage.getItem(
                "bookSahayakRecentSearches"
            ) || "[]"
        );


    recentSearchList.innerHTML =
        "";


    if (
        recent.length === 0
    ) {

        recentSearchSection.classList.add(
            "search-hidden"
        );

        return;

    }


    recentSearchSection.classList.remove(
        "search-hidden"
    );


    recent.forEach(
        function (item) {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "recent-search-item";


            button.innerHTML =
                "<span>🕘</span>" +
                "<span>" +
                    escapeHTML(
                        item
                    ) +
                "</span>";


            button.addEventListener(
                "click",
                function () {

                    searchInput.value =
                        item;

                    performSearch();

                    searchInput.focus();

                }
            );


            recentSearchList.appendChild(
                button
            );

        }
    );

}


/* =========================
   BACK BUTTON
========================= */

function goBack() {

    window.location.href =
        "home.html";

}


if (backButton) {

    backButton.addEventListener(
        "click",
        goBack
    );

}


/* =========================
   CATEGORY ICON
========================= */

function getCategoryIcon(
    category
) {

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

function escapeHTML(
    value
) {

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
/* =========================
   DARK MODE
========================= */

const searchThemeBtn =
    document.getElementById(
        "searchThemeBtn"
    );


function applySearchTheme() {

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


    if (searchThemeBtn) {

        searchThemeBtn.textContent =
            isDark
                ? "☀️"
                : "🌙";

    }

}


applySearchTheme();


if (searchThemeBtn) {

    searchThemeBtn.addEventListener(
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


            searchThemeBtn.textContent =
                isDark
                    ? "☀️"
                    : "🌙";

        }
    );

}
