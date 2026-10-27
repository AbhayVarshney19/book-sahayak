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
const categoryFilter = document.getElementById("filterCategory");
const conditionFilter = document.getElementById("filterCondition");
const priceFilter = document.getElementById("filterPrice");
const sortFilter = document.getElementById("sortListings");
const resetFiltersButton = document.getElementById("resetSearchFilters");


/* =========================
   DATA
========================= */

let allMaterials = [];
let resultLimit = 24;

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
    const searchText = searchInput.value.toLowerCase().trim();
    const hasFilters = Boolean(categoryFilter?.value || conditionFilter?.value || priceFilter?.value);
    if (!searchText && !hasFilters) { showEmptyState(); return; }
    const words = searchText.split(/\s+/).filter(Boolean);
    const filtered = allMaterials.filter((material) => {
        const searchableText = [material.title, material.category, material.subject, material.description, material.uploaderName, material.condition, material.price, material.isFree ? "free" : ""]
            .filter((value) => value !== undefined && value !== null).join(" ").toLowerCase();
        if (!words.every((word) => searchableText.includes(word))) return false;
        if (categoryFilter?.value && material.category !== categoryFilter.value) return false;
        if (conditionFilter?.value === "Digital" && material.condition !== "Digital") return false;
        if (conditionFilter?.value === "Physical" && (!material.condition || material.condition === "Digital")) return false;
        const free = material.isFree === true || Number(material.price) <= 0;
        if (priceFilter?.value === "free" && !free) return false;
        if (priceFilter?.value === "paid" && free) return false;
        return true;
    });
    const priceOf = (material) => material.isFree || Number(material.price) <= 0 ? 0 : Number(material.price);
    const dateOf = (material) => material.createdAt?.toMillis?.() || material.createdAt?.toDate?.()?.getTime() || new Date(material.createdAt || 0).getTime() || 0;
    if (sortFilter?.value === "price-low") filtered.sort((a, b) => priceOf(a) - priceOf(b));
    else if (sortFilter?.value === "price-high") filtered.sort((a, b) => priceOf(b) - priceOf(a));
    else if (sortFilter?.value === "title") filtered.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
    else filtered.sort((a, b) => dateOf(b) - dateOf(a));
    popularSection.classList.add("search-hidden");
    resultLimit = 24;
    renderResults(filtered, searchText || "all listings");
}

[categoryFilter, conditionFilter, priceFilter, sortFilter].forEach((control) => control?.addEventListener("change", performSearch));
resetFiltersButton?.addEventListener("click", () => {
    if (categoryFilter) categoryFilter.value = "";
    if (conditionFilter) conditionFilter.value = "";
    if (priceFilter) priceFilter.value = "";
    if (sortFilter) sortFilter.value = "newest";
    performSearch();
});


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


    materials.slice(0, resultLimit).forEach(
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


    if (materials.length > resultLimit) {
        const more = document.createElement("button");
        more.type = "button"; more.className = "search-load-more";
        const nextCount = Math.min(24, materials.length - resultLimit);
        more.textContent = "Show " + nextCount + " more";
        more.addEventListener("click", () => { resultLimit += 24; renderResults(materials, searchText); });
        searchResults.append(more);
    }
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

            performSearch();

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


    let recent = loadSavedRecentSearches();


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


    try {
        localStorage.setItem("bookSahayakRecentSearches", JSON.stringify(recent));
    } catch (error) {
        console.warn("Could not save recent searches:", error);
    }


    loadRecentSearches();

}


/* =========================
   LOAD RECENT SEARCHES
========================= */

function loadRecentSearches() {

    const recent = loadSavedRecentSearches();


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

function loadSavedRecentSearches() {
    try {
        const saved = JSON.parse(localStorage.getItem("bookSahayakRecentSearches") || "[]");
        return Array.isArray(saved)
            ? saved.filter((item) => typeof item === "string" && item.trim()).slice(0, 5)
            : [];
    } catch (error) {
        console.warn("Could not read recent searches:", error);
        return [];
    }
}

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
