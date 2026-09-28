import { auth, db, ADMIN_UID } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
    collection,
    doc,
    getDocs,
    serverTimestamp,
    updateDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const pendingMaterials = document.getElementById("pendingMaterials");
const adminMessage = document.getElementById("adminMessage");
const pendingCount = document.getElementById("pendingCount");
const approvedCount = document.getElementById("approvedCount");
const legacyCount = document.getElementById("legacyCount");
const migrationPanel = document.getElementById("migrationPanel");
const approveExistingBtn = document.getElementById("approveExistingBtn");
const refreshListingsBtn = document.getElementById("refreshListingsBtn");
const listingSearch = document.getElementById("listingSearch");
const categoryFilter = document.getElementById("categoryFilter");
const emptyState = document.getElementById("adminEmptyState");
const emptyTitle = document.getElementById("adminEmptyTitle");
const emptyDescription = document.getElementById("adminEmptyDescription");
const adminDashboard = document.getElementById("adminDashboard");
const adminAccessDenied = document.getElementById("adminAccessDenied");
const rejectDialog = document.getElementById("rejectDialog");
const rejectForm = document.getElementById("rejectForm");
const rejectListingTitle = document.getElementById("rejectListingTitle");
const rejectFeedbackInput = document.getElementById("rejectFeedbackInput");
const rejectFeedbackError = document.getElementById("rejectFeedbackError");
const confirmRejectBtn = document.getElementById("confirmRejectBtn");
const cancelRejectBtn = document.getElementById("cancelRejectBtn");
const adminThemeToggle = document.getElementById("adminThemeToggle");

let pendingDocuments = [];
let rejectionTarget = null;

function applyAdminTheme() {
    const isDark = localStorage.getItem("bookSahayakTheme") === "dark";
    document.body.classList.toggle("dark-mode", isDark);
    adminThemeToggle.innerHTML = `${isDark ? "☀️" : "🌙"} <span>${isDark ? "Light" : "Dark"}</span>`;
    adminThemeToggle.setAttribute("aria-pressed", String(isDark));
}

applyAdminTheme();
adminThemeToggle?.addEventListener("click", () => {
    const isDark = !document.body.classList.contains("dark-mode");
    localStorage.setItem("bookSahayakTheme", isDark ? "dark" : "light");
    applyAdminTheme();
});

window.addEventListener("storage", (event) => {
    if (event.key === "bookSahayakTheme") applyAdminTheme();
});

function setMessage(text, state = "info") {
    if (!adminMessage) return;
    adminMessage.textContent = text;
    adminMessage.dataset.state = state;
}

function makeTextElement(tag, text, className = "") {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
}

function addDetail(container, label, value) {
    const detail = document.createElement("div");
    detail.className = "admin-detail";
    detail.append(
        makeTextElement("span", label, "admin-detail-label"),
        makeTextElement("span", value || "Not specified", "admin-detail-value")
    );
    container.append(detail);
}

function formatDate(timestamp) {
    try {
        const date = typeof timestamp?.toDate === "function"
            ? timestamp.toDate()
            : timestamp
                ? new Date(timestamp)
                : null;
        if (!date || Number.isNaN(date.getTime())) return "Date not provided";
        return date.toLocaleDateString([], {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    } catch {
        return "Date not provided";
    }
}

function createReviewCard(materialDocument) {
    const material = materialDocument.data();
    const card = document.createElement("article");
    card.className = "admin-material-card";

    const cardTop = document.createElement("div");
    cardTop.className = "admin-card-top";
    cardTop.append(
        makeTextElement("span", material.category || "Resource", "admin-category"),
        makeTextElement("span", "Needs review", "admin-review-badge")
    );

    card.append(
        cardTop,
        makeTextElement("h3", material.title || "Untitled material", "admin-card-title"),
        makeTextElement("p", `📘 ${material.subject || "Subject not specified"}`, "admin-card-subject"),
        makeTextElement("p", material.description || "No description provided.", "admin-card-description")
    );

    const details = document.createElement("div");
    details.className = "admin-card-details";
    const price = material.isFree || Number(material.price) === 0
        ? "Free"
        : material.price !== undefined && material.price !== null && material.price !== ""
            ? `₹${material.price}`
            : "Not specified";
    addDetail(details, "Price", price);
    addDetail(details, "Condition", material.condition || "Digital");
    addDetail(details, "Submitted", formatDate(material.createdAt));
    addDetail(details, "Contact", material.contactNumber || "Not provided");
    card.append(details);

    const uploader = document.createElement("div");
    uploader.className = "admin-uploader-row";
    uploader.append(
        makeTextElement("span", (material.uploaderName || "S").trim().slice(0, 1).toUpperCase(), "admin-uploader-avatar")
    );
    const uploaderCopy = document.createElement("div");
    uploaderCopy.className = "admin-uploader-copy";
    uploaderCopy.append(
        makeTextElement("strong", material.uploaderName || "Student"),
        makeTextElement("span", material.uploaderEmail || "Resource uploader")
    );
    uploader.append(uploaderCopy);
    card.append(uploader);

    if (material.fileURL) {
        const fileLink = document.createElement("a");
        fileLink.href = material.fileURL;
        fileLink.target = "_blank";
        fileLink.rel = "noopener noreferrer";
        fileLink.textContent = material.fileName || "Open attached resource";
        fileLink.className = "admin-file-link";
        fileLink.title = "Open attached resource in a new tab";
        card.append(fileLink);
    }

    const actions = document.createElement("div");
    actions.className = "admin-review-actions";
    const approveButton = makeTextElement("button", "✓  Approve listing", "admin-approve-btn");
    const rejectButton = makeTextElement("button", "Decline", "admin-reject-btn");
    approveButton.type = "button";
    rejectButton.type = "button";
    approveButton.setAttribute("aria-label", `Approve ${material.title || "listing"}`);
    rejectButton.setAttribute("aria-label", `Reject ${material.title || "listing"}`);
    approveButton.addEventListener("click", () => reviewMaterial(materialDocument.id, "approved", card));
    rejectButton.addEventListener("click", () => {
        rejectionTarget = {
            id: materialDocument.id,
            card,
            title: material.title || "Untitled material"
        };
        rejectListingTitle.textContent = rejectionTarget.title;
        rejectFeedbackInput.value = "";
        rejectFeedbackError.textContent = "";
        rejectDialog.showModal();
        rejectFeedbackInput.focus();
    });
    actions.append(approveButton, rejectButton);
    card.append(actions);

    return card;
}

function updateCategoryOptions() {
    if (!categoryFilter) return;
    const selected = categoryFilter.value || "all";
    const categories = [...new Set(
        pendingDocuments.map((item) => item.data().category || "Resource")
    )].sort((a, b) => a.localeCompare(b));

    categoryFilter.replaceChildren(new Option("All categories", "all"));
    categories.forEach((category) => {
        categoryFilter.add(new Option(category, category));
    });
    categoryFilter.value = categories.includes(selected) ? selected : "all";
}

function renderPendingMaterials() {
    if (!pendingMaterials) return;
    const search = (listingSearch?.value || "").trim().toLowerCase();
    const category = categoryFilter?.value || "all";
    const filtered = pendingDocuments.filter((item) => {
        const material = item.data();
        const searchable = [
            material.title,
            material.subject,
            material.uploaderName,
            material.uploaderEmail,
            material.description
        ].filter(Boolean).join(" ").toLowerCase();
        const matchesSearch = !search || searchable.includes(search);
        const matchesCategory = category === "all" || (material.category || "Resource") === category;
        return matchesSearch && matchesCategory;
    });

    pendingMaterials.replaceChildren(...filtered.map(createReviewCard));
    if (emptyState) emptyState.hidden = filtered.length > 0;

    if (filtered.length === 0 && emptyTitle && emptyDescription) {
        if (pendingDocuments.length === 0) {
            emptyTitle.textContent = "You're all caught up";
            emptyDescription.textContent = "There are no listings waiting for review right now.";
        } else {
            emptyTitle.textContent = "No matching listings";
            emptyDescription.textContent = "Try another title, subject, uploader, or category.";
        }
    }
}

async function reviewMaterial(id, status, card, feedback = "") {
    const action = status === "approved" ? "Approving" : "Rejecting";

    try {
        card.querySelectorAll("button").forEach((button) => { button.disabled = true; });
        setMessage(`${action} listing…`);

        await updateDoc(doc(db, "materials", id), {
            status,
            reviewFeedback: status === "rejected" ? feedback : "",
            reviewedAt: serverTimestamp(),
            reviewedBy: auth.currentUser.uid
        });

        await loadPendingMaterials();
        setMessage(
            status === "approved"
                ? "Listing approved and published."
                : "Listing rejected. The uploader can see its rejected status in My Materials.",
            "success"
        );
    } catch (error) {
        setMessage(`Could not review listing: ${error.message}`, "error");
        card.querySelectorAll("button").forEach((button) => { button.disabled = false; });
    }
}

rejectForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const feedback = rejectFeedbackInput.value.trim();

    if (!feedback) {
        rejectFeedbackError.textContent = "Add a short explanation so the uploader knows what to improve.";
        rejectFeedbackInput.focus();
        return;
    }

    if (!rejectionTarget) return;

    rejectFeedbackError.textContent = "";
    confirmRejectBtn.disabled = true;
    cancelRejectBtn.disabled = true;
    rejectDialog.close();

    try {
        await reviewMaterial(rejectionTarget.id, "rejected", rejectionTarget.card, feedback);
    } finally {
        confirmRejectBtn.disabled = false;
        cancelRejectBtn.disabled = false;
        rejectionTarget = null;
    }
});

cancelRejectBtn?.addEventListener("click", () => {
    rejectionTarget = null;
    rejectFeedbackError.textContent = "";
    rejectDialog.close();
});

rejectDialog?.addEventListener("click", (event) => {
    if (event.target === rejectDialog) {
        rejectionTarget = null;
        rejectFeedbackError.textContent = "";
        rejectDialog.close();
    }
});

async function loadPendingMaterials() {
    if (refreshListingsBtn) refreshListingsBtn.disabled = true;
    setMessage("Refreshing listings…");

    try {
        const snapshot = await getDocs(collection(db, "materials"));
        pendingDocuments = snapshot.docs.filter((item) => item.data().status === "pending");
        const approved = snapshot.docs.filter((item) => item.data().status === "approved");
        const legacy = snapshot.docs.filter((item) => !item.data().status);

        pendingCount.textContent = pendingDocuments.length;
        approvedCount.textContent = approved.length;
        legacyCount.textContent = legacy.length;
        migrationPanel.hidden = legacy.length === 0;

        updateCategoryOptions();
        renderPendingMaterials();

        if (pendingDocuments.length === 0) {
            setMessage("No listings are waiting for review.", "success");
        } else {
            setMessage(`${pendingDocuments.length} listing${pendingDocuments.length === 1 ? "" : "s"} awaiting review.`);
        }
    } catch (error) {
        setMessage(`Could not load pending listings: ${error.message}`, "error");
    } finally {
        if (refreshListingsBtn) refreshListingsBtn.disabled = false;
    }
}

async function approveExistingListings() {
    try {
        approveExistingBtn.disabled = true;
        setMessage("Approving older listings…");
        const snapshot = await getDocs(collection(db, "materials"));
        const legacy = snapshot.docs.filter((item) => !item.data().status);

        if (legacy.length === 0) {
            await loadPendingMaterials();
            return;
        }

        const batch = writeBatch(db);
        legacy.forEach((item) => {
            batch.update(item.ref, {
                status: "approved",
                reviewedAt: serverTimestamp(),
                reviewedBy: auth.currentUser.uid
            });
        });
        await batch.commit();
        await loadPendingMaterials();
        setMessage(`${legacy.length} older listing${legacy.length === 1 ? "" : "s"} approved.`, "success");
    } catch (error) {
        setMessage(`Could not approve older listings: ${error.message}`, "error");
    } finally {
        approveExistingBtn.disabled = false;
    }
}

approveExistingBtn?.addEventListener("click", approveExistingListings);
refreshListingsBtn?.addEventListener("click", loadPendingMaterials);
listingSearch?.addEventListener("input", renderPendingMaterials);
categoryFilter?.addEventListener("change", renderPendingMaterials);

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    if (user.uid !== ADMIN_UID) {
        adminDashboard.hidden = true;
        adminAccessDenied.hidden = false;
        return;
    }

    loadPendingMaterials();
});
