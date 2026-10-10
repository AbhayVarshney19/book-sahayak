import { auth, db, ADMIN_UID } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const themeBtn = document.getElementById("themeBtn");
const logoutBtn = document.getElementById("profileLogoutBtn");
const statusElement = document.getElementById("profileStatus");
const adminLink = document.getElementById("adminLink");

function applyTheme() {
    const isDark = localStorage.getItem("bookSahayakTheme") === "dark";
    document.body.classList.toggle("dark-mode", isDark);
    if (themeBtn) themeBtn.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
}

applyTheme();

themeBtn?.addEventListener("click", () => {
    const isDark = !document.body.classList.contains("dark-mode");
    document.body.classList.toggle("dark-mode", isDark);
    localStorage.setItem("bookSahayakTheme", isDark ? "dark" : "light");
    themeBtn.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
});

function displayProvider(user) {
    const providerIds = [...new Set(user.providerData.map((provider) => provider.providerId))];
    const labels = {
        "google.com": "Google",
        "password": "Email and password",
        "facebook.com": "Facebook",
        "phone": "Phone",
        "apple.com": "Apple"
    };
    return providerIds.map((providerId) => labels[providerId] || "Secure sign-in").join(", ") || "Secure sign-in";
}

function formatJoinDate(value) {
    if (!value) return "Not available";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "Not available"
        : date.toLocaleDateString([], { year: "numeric", month: "long" });
}

async function loadListingSummary(user) {
    const totals = { total: 0, approved: 0, pending: 0 };
    const snapshot = await getDocs(query(
        collection(db, "materials"),
        where("uploadedBy", "==", user.uid)
    ));

    snapshot.forEach((listing) => {
        totals.total += 1;
        const listingStatus = String(listing.data().status || "").toLowerCase();
        if (listingStatus === "approved") totals.approved += 1;
        if (listingStatus === "pending") totals.pending += 1;
    });

    document.getElementById("totalListings").textContent = String(totals.total);
    document.getElementById("approvedListings").textContent = String(totals.approved);
    document.getElementById("pendingListings").textContent = String(totals.pending);
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("index.html");
        return;
    }

    if (adminLink) adminLink.hidden = user.uid !== ADMIN_UID;

    let name = user.displayName || "Student";
    try {
        const profileSnapshot = await getDoc(doc(db, "users", user.uid));
        if (profileSnapshot.exists()) name = profileSnapshot.data().name || name;
    } catch (error) {
        console.warn("Could not load saved profile name:", error);
    }

    const email = user.email || "Email not available";
    document.getElementById("profileName").textContent = name;
    document.getElementById("navProfileName").textContent = name;
    document.getElementById("profileEmail").textContent = email;
    document.getElementById("detailName").textContent = name;
    document.getElementById("detailEmail").textContent = email;
    document.getElementById("detailProvider").textContent = displayProvider(user);
    document.getElementById("detailJoined").textContent = formatJoinDate(user.metadata?.creationTime);

    const initial = name.trim().charAt(0).toUpperCase();
    document.getElementById("profileAvatar").textContent = initial || "👤";
    document.getElementById("profileVerified").hidden = !user.emailVerified;

    try {
        await loadListingSummary(user);
    } catch (error) {
        console.error("Could not load listing summary:", error);
        ["totalListings", "approvedListings", "pendingListings"].forEach((id) => {
            document.getElementById(id).textContent = "—";
        });
        if (statusElement) statusElement.textContent = "Your account loaded, but listing totals are temporarily unavailable.";
    }
});

logoutBtn?.addEventListener("click", async () => {
    logoutBtn.disabled = true;
    logoutBtn.textContent = "Signing out…";
    try {
        await signOut(auth);
        window.location.replace("index.html");
    } catch (error) {
        console.error("Sign-out failed:", error);
        if (statusElement) statusElement.textContent = "Could not sign out. Please try again.";
        logoutBtn.disabled = false;
        logoutBtn.textContent = "Sign out";
    }
});
