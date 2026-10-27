import { auth, db } from "./firebase.js";
import { formatListingDateTime } from "./listing-date.js";
import { clearRecentListings, getRecentListings, removeRecentListing } from "./recent-listings.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const list = document.getElementById("recentListingsList");
const count = document.getElementById("recentListingsCount");
const status = document.getElementById("recentListingsStatus");
const clearButton = document.getElementById("clearRecentListings");
let currentUser = null;

function makeText(tag, text, className = "") {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
}

function listingPrice(material) {
    return material.isFree || Number(material.price) <= 0
        ? "Free"
        : `₹${Number(material.price).toLocaleString("en-IN")}`;
}

function renderEmpty() {
    list.replaceChildren();
    const empty = document.createElement("section");
    empty.className = "recent-listings-empty";
    empty.append(
        makeText("span", "🔎", "recent-empty-icon"),
        makeText("h2", "Your recent listings will show up here"),
        makeText("p", "Open a listing that interests you and you can come back to it from this page." )
    );
    const browse = document.createElement("a");
    browse.href = "home.html#materialsList";
    browse.className = "recent-browse-btn";
    browse.textContent = "Browse listings";
    empty.append(browse);
    list.append(empty);
    count.textContent = "0 listings";
    clearButton.hidden = true;
}

function createListingCard(entry, material) {
    const card = document.createElement("article");
    card.className = "recent-listing-card";
    const top = document.createElement("div");
    top.className = "recent-listing-card-top";
    top.append(makeText("span", "📚", "recent-listing-icon"));
    top.append(makeText("span", listingPrice(material), "recent-listing-price"));
    card.append(top);

    card.append(makeText("h2", material.title || "Untitled listing", "recent-listing-title"));
    card.append(makeText("p", `${material.subject || "Subject not specified"}${material.category ? ` · ${material.category}` : ""}`, "recent-listing-subtitle"));
    card.append(makeText("p", material.description || "No description provided.", "recent-listing-description"));

    const metadata = document.createElement("div");
    metadata.className = "recent-listing-meta";
    metadata.append(makeText("span", `${material.condition || "Digital"} resource`));
    metadata.append(makeText("span", `Viewed ${formatListingDateTime(entry.viewedAt)}`));
    card.append(metadata);

    const actions = document.createElement("div");
    actions.className = "recent-listing-actions";
    const open = document.createElement("a");
    open.href = `material.html?id=${encodeURIComponent(entry.id)}`;
    open.className = "recent-open-btn";
    open.textContent = "View listing";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "recent-remove-btn";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${material.title || "listing"} from recently viewed`);
    remove.addEventListener("click", () => {
        removeRecentListing(currentUser.uid, entry.id);
        loadRecentListings();
    });
    actions.append(open, remove);
    card.append(actions);
    return card;
}

async function loadRecentListings() {
    if (!currentUser) return;
    list.replaceChildren(makeText("p", "Loading your recently viewed listings…", "recent-listings-loading"));
    const entries = getRecentListings(currentUser.uid);
    if (!entries.length) {
        renderEmpty();
        return;
    }

    const results = await Promise.all(entries.map(async (entry) => {
        try {
            const snapshot = await getDoc(doc(db, "materials", entry.id));
            if (!snapshot.exists()) return null;
            const material = snapshot.data();
            if (material.status !== "approved") return null;
            return { entry, material };
        } catch (error) {
            console.warn("Could not load a recently viewed listing:", entry.id, error);
            return { entry, error };
        }
    }));

    const available = results.filter((result) => result?.material);
    const errors = results.filter((result) => result?.error);
    const unavailableIds = entries.filter((entry) => !results.some((result) => result?.entry.id === entry.id && (result.material || result.error))).map((entry) => entry.id);
    unavailableIds.forEach((id) => removeRecentListing(currentUser.uid, id));

    list.replaceChildren();
    if (!available.length && errors.length) {
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "recent-browse-btn";
        retry.textContent = "Try again";
        retry.addEventListener("click", loadRecentListings);
        const errorPanel = document.createElement("section");
        errorPanel.className = "recent-listings-empty recent-listings-error";
        errorPanel.append(
            makeText("span", "⚠️", "recent-empty-icon"),
            makeText("h2", "Could not load your listings"),
            makeText("p", "Your recent history is still saved. Check your connection and try again.") ,
            retry
        );
        list.append(errorPanel);
        count.textContent = "Saved";
        clearButton.hidden = false;
        status.textContent = "Your viewing history is saved in this browser.";
        return;
    }
    if (!available.length) {
        renderEmpty();
        return;
    }
    const grid = document.createElement("div");
    grid.className = "recent-listings-grid";
    available.forEach(({ entry, material }) => grid.append(createListingCard(entry, material)));
    list.append(grid);
    count.textContent = `${available.length} ${available.length === 1 ? "listing" : "listings"}`;
    clearButton.hidden = false;
    status.textContent = errors.length
        ? "Some listings could not be loaded right now. Your viewing history is still saved."
        : "Saved only in this browser, for your account.";
}

clearButton.addEventListener("click", () => {
    if (!currentUser) return;
    clearRecentListings(currentUser.uid);
    loadRecentListings();
    status.textContent = "Your recently viewed list has been cleared.";
});

document.getElementById("recentBackBtn").addEventListener("click", () => {
    window.location.href = "home.html";
});

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    currentUser = user;
    loadRecentListings();
});
