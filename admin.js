import { auth, db, ADMIN_UID } from "./firebase.js";
import { formatListingDateTime } from "./listing-date.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
    collection,
    doc,
    getDocs,
    serverTimestamp,
    updateDoc,
    writeBatch,
    deleteField
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const pendingMaterials = document.getElementById("pendingMaterials");
const manageListingsElement = document.getElementById("manageListings");
const manageListingsMessage = document.getElementById("manageListingsMessage");
const manageListingsEmpty = document.getElementById("manageListingsEmpty");
const manageListingSearch = document.getElementById("manageListingSearch");
const scanOrphanFilesBtn = document.getElementById("scanOrphanFilesBtn");
const orphanFilesMessage = document.getElementById("orphanFilesMessage");
const orphanFilesList = document.getElementById("orphanFilesList");
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
let pendingDocuments = [];
let allListingDocuments = [];
let rejectionTarget = null;

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

function isPaidDigitalListing(material) {
    return material?.condition === "Digital" && (
        material.isFree === false ||
        (material.isFree !== true && Number(material.price) > 0)
    );
}

function formatDate(timestamp) {
    try {
        const date = typeof timestamp?.toDate === "function"
            ? timestamp.toDate()
            : timestamp
                ? new Date(timestamp)
                : null;
        if (!date || Number.isNaN(date.getTime())) return "Date not provided";
        return formatListingDateTime(date);
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
        makeTextElement("span", "Resource uploader")
    );
    uploader.append(uploaderCopy);
    card.append(uploader);

    if (isPaidDigitalListing(material) && material.accessMode === "owner-approval") {
        const inspectButton = makeTextElement("button", `🔒 Inspect original (${material.fileName || "PDF"})`, "admin-file-link");
        inspectButton.type = "button";
        inspectButton.addEventListener("click", async () => {
            inspectButton.disabled = true;
            inspectButton.textContent = "Loading protected file…";
            try {
                const token = await auth.currentUser.getIdToken();
                const endpoint = new URL("https://us-central1-book-sahayak.cloudfunctions.net/downloadApprovedDigitalResource");
                endpoint.searchParams.set("materialId", materialDocument.id);
                const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
                if (!response.ok) throw new Error(await response.text());
                const fileUrl = URL.createObjectURL(await response.blob());
                const link = document.createElement("a");
                link.href = fileUrl;
                link.download = material.fileName || "resource.pdf";
                document.body.append(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(fileUrl), 60_000);
                inspectButton.textContent = "Original downloaded";
            } catch (error) {
                console.error("Admin file inspection failed:", error);
                inspectButton.disabled = false;
                inspectButton.textContent = "Could not load original — retry";
            }
        });
        card.append(inspectButton);
    } else if (material.fileURL) {
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

function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "Unknown size";
    if (bytes < 1024 * 1024) return Math.ceil(bytes / 1024) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

async function scanOrphanFiles() {
    if (!orphanFilesList || !orphanFilesMessage) return;
    scanOrphanFilesBtn.disabled = true;
    scanOrphanFilesBtn.textContent = "Scanning…";
    orphanFilesMessage.textContent = "Checking uploaded files against current listings…";
    orphanFilesList.replaceChildren();
    try {
        const result = await httpsCallable(getFunctions(), "adminListOrphanedMaterialFiles")();
        const files = result.data.files || [];
        if (!files.length) {
            orphanFilesMessage.textContent = "No unlinked uploaded files found.";
            return;
        }
        orphanFilesMessage.textContent = files.length + (result.data.truncated ? "+" : "") + " unlinked file" + (files.length === 1 ? "" : "s") + " found.";
        files.forEach((file) => {
            const row = document.createElement("article");
            row.className = "admin-orphan-row";
            const details = document.createElement("div");
            details.className = "admin-orphan-details";
            details.append(
                makeTextElement("strong", file.path.split("/").pop() || file.path),
                makeTextElement("span", file.path),
                makeTextElement("small", formatFileSize(file.size))
            );
            const remove = makeTextElement("button", "Delete file", "admin-listing-delete-btn");
            remove.type = "button";
            remove.addEventListener("click", async () => {
                if (!window.confirm("Permanently delete “" + file.path + "” (" + formatFileSize(file.size) + ") from Storage?")) return;
                remove.disabled = true;
                remove.textContent = "Deleting…";
                try {
                    await httpsCallable(getFunctions(), "adminDeleteOrphanedMaterialFile")({ path: file.path });
                    row.remove();
                    const remaining = orphanFilesList.children.length;
                    orphanFilesMessage.textContent = remaining
                        ? remaining + " unlinked file" + (remaining === 1 ? "" : "s") + " remain."
                        : "All scanned unlinked files have been deleted.";
                } catch (error) {
                    console.error("Could not delete unlinked file:", error);
                    remove.disabled = false;
                    remove.textContent = "Retry delete";
                    orphanFilesMessage.textContent = "Could not delete file: " + error.message;
                }
            });
            row.append(details, remove);
            orphanFilesList.append(row);
        });
    } catch (error) {
        console.error("Storage scan failed:", error);
        orphanFilesMessage.textContent = "Could not scan Storage: " + error.message;
    } finally {
        scanOrphanFilesBtn.disabled = false;
        scanOrphanFilesBtn.textContent = "Scan Storage";
    }
}

function renderManageListings() {
    if (!manageListingsElement) return;
    const search = (manageListingSearch?.value || "").trim().toLowerCase();
    const filtered = allListingDocuments.filter((item) => {
        const material = item.data();
        return !search || [material.title, material.subject, material.uploaderName, item.id]
            .filter(Boolean).join(" ").toLowerCase().includes(search);
    });
    manageListingsElement.replaceChildren();
    filtered.forEach((item) => {
        const material = item.data();
        const card = document.createElement("article");
        card.className = "admin-material-card admin-manage-card";
        const status = material.status || "older listing";
        const top = document.createElement("div");
        top.className = "admin-card-top";
        top.append(
            makeTextElement("span", material.category || "Resource", "admin-category"),
            makeTextElement("span", status.replaceAll("-", " "), "admin-listing-status")
        );
        const priceLabel = material.isFree ? "Free" : "₹" + (material.price ?? "Not priced");
        card.append(
            top,
            makeTextElement("h3", material.title || "Untitled listing", "admin-card-title"),
            makeTextElement("p", "By " + (material.uploaderName || "Student") + " · " + formatDate(material.createdAt), "admin-card-subject"),
            makeTextElement("p", (material.condition || "Digital") + " · " + priceLabel, "admin-card-description")
        );
        const actions = document.createElement("div");
        actions.className = "admin-manage-actions";
        const view = document.createElement("a");
        view.href = "material.html?id=" + encodeURIComponent(item.id);
        view.target = "_blank";
        view.rel = "noopener noreferrer";
        view.className = "admin-manage-view";
        view.textContent = "View listing";
        const needsFileSecurity = isPaidDigitalListing(material) &&
            typeof material.storagePath === "string" &&
            material.uploadedBy &&
            material.storagePath.startsWith(`materials/${material.uploadedBy}/`);
        let secure = null;
        if (needsFileSecurity) {
            secure = makeTextElement("button", "Secure paid file", "admin-listing-secure-btn");
            secure.type = "button";
            secure.title = "Move this older paid digital file into private storage and remove its public copy.";
            secure.addEventListener("click", async () => {
                if (!window.confirm("Secure the paid digital file for ‘" + (material.title || "this listing") + "’? This moves the original to private storage and removes its public copy.")) return;
                secure.disabled = true;
                secure.textContent = "Securing…";
                if (manageListingsMessage) manageListingsMessage.textContent = "Moving the paid file into private storage…";
                try {
                    await httpsCallable(getFunctions(), "secureLegacyPaidDigitalResource")({ materialId: item.id });
                    if (manageListingsMessage) manageListingsMessage.textContent = "The paid file is now private. The listing’s preview status has been updated.";
                    await loadPendingMaterials();
                } catch (error) {
                    console.error("Could not secure paid digital file:", error);
                    secure.disabled = false;
                    secure.textContent = "Retry file security";
                    if (manageListingsMessage) manageListingsMessage.textContent = "Could not secure this file: " + error.message;
                }
            });
        }
        const remove = makeTextElement("button", "Delete listing", "admin-listing-delete-btn");
        remove.type = "button";
        remove.addEventListener("click", async () => {
            const label = material.title || "this listing";
            if (!window.confirm("Permanently delete ‘" + label + "’, its uploaded file and preview, and its download requests? This cannot be undone.")) return;
            remove.disabled = true;
            remove.textContent = "Deleting…";
            if (manageListingsMessage) manageListingsMessage.textContent = "Deleting " + label + "…";
            try {
                await httpsCallable(getFunctions(), "adminDeleteListing")({ materialId: item.id });
                if (manageListingsMessage) manageListingsMessage.textContent = "Deleted ‘" + label + "’ and its stored files.";
                await loadPendingMaterials();
            } catch (error) {
                console.error("Could not delete listing:", error);
                remove.disabled = false;
                remove.textContent = "Retry delete";
                if (manageListingsMessage) manageListingsMessage.textContent = "Could not delete listing: " + error.message;
            }
        });
        actions.append(view);
        if (secure) actions.append(secure);
        actions.append(remove);
        card.append(actions);
        manageListingsElement.append(card);
    });
    if (manageListingsEmpty) manageListingsEmpty.hidden = filtered.length > 0;
    if (manageListingsMessage) {
        manageListingsMessage.textContent = allListingDocuments.length
            ? allListingDocuments.length + " listing" + (allListingDocuments.length === 1 ? "" : "s") + " in the library."
            : "There are no listings in the library.";
    }
}

async function reviewMaterial(id, status, card, feedback = "") {
    const action = status === "approved" ? "Approving" : "Rejecting";

    try {
        const material = pendingDocuments.find((item) => item.id === id)?.data();
        if (
            status === "approved" &&
            isPaidDigitalListing(material) &&
            (
                material.accessMode !== "owner-approval" ||
                material.previewStatus !== "ready" ||
                typeof material.storagePath !== "string" ||
                !material.storagePath.startsWith("private-materials/") ||
                Object.prototype.hasOwnProperty.call(material, "fileURL")
            )
        ) {
            throw new Error("Secure the original and prepare its PDF preview before approving this paid digital listing.");
        }

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

async function removePublicUploaderEmails(documents) {
    const toClean = documents.filter((item) =>
        Object.prototype.hasOwnProperty.call(item.data(), "uploaderEmail")
    );
    for (let start = 0; start < toClean.length; start += 450) {
        const batch = writeBatch(db);
        toClean.slice(start, start + 450).forEach((item) => {
            batch.update(item.ref, { uploaderEmail: deleteField() });
        });
        await batch.commit();
    }
    return toClean.length;
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
        let removedEmails = 0;
        let emailCleanupFailed = false;
        try {
            removedEmails = await removePublicUploaderEmails(snapshot.docs);
        } catch (cleanupError) {
            emailCleanupFailed = true;
            console.error("Could not remove email addresses from public listings:", cleanupError);
        }
        allListingDocuments = snapshot.docs;
        renderManageListings();
        pendingDocuments = snapshot.docs.filter((item) => item.data().status === "pending");
        const approved = snapshot.docs.filter((item) => item.data().status === "approved");
        const legacy = snapshot.docs.filter((item) => !item.data().status);

        pendingCount.textContent = pendingDocuments.length;
        approvedCount.textContent = approved.length;
        legacyCount.textContent = legacy.length;
        migrationPanel.hidden = legacy.length === 0;
        if (removedEmails > 0) {
            console.info(`Removed uploader emails from ${removedEmails} listing records.`);
        }

        updateCategoryOptions();
        renderPendingMaterials();

        if (emailCleanupFailed) {
            setMessage("Listings loaded, but email privacy cleanup failed. Refresh while signed in as admin.", "error");
        } else if (pendingDocuments.length === 0) {
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
        await removePublicUploaderEmails(snapshot.docs);
        const legacy = snapshot.docs.filter((item) => !item.data().status);
        const safeLegacy = legacy.filter((item) => {
            const material = item.data();
            const isPaidDigital = isPaidDigitalListing(material);
            return !isPaidDigital || (
                material.accessMode === "owner-approval" &&
                material.previewStatus === "ready" &&
                typeof material.storagePath === "string" &&
                material.storagePath.startsWith("private-materials/")
            );
        });
        approveExistingBtn.disabled = safeLegacy.length === 0;

        if (safeLegacy.length === 0) {
            await loadPendingMaterials();
            if (legacy.length > 0) {
                setMessage("No older listings were auto-approved because their paid digital files still need protection and a preview.", "error");
            }
            return;
        }

        const batch = writeBatch(db);
        safeLegacy.forEach((item) => {
            batch.update(item.ref, {
                status: "approved",
                reviewedAt: serverTimestamp(),
                reviewedBy: auth.currentUser.uid
            });
        });
        await batch.commit();
        await loadPendingMaterials();
        const skipped = legacy.length - safeLegacy.length;
        setMessage(
            `${safeLegacy.length} older listing${safeLegacy.length === 1 ? "" : "s"} approved.${skipped ? ` ${skipped} paid digital listing${skipped === 1 ? " was" : "s were"} skipped until secured with a preview.` : ""}`,
            skipped ? "info" : "success"
        );
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
manageListingSearch?.addEventListener("input", renderManageListings);
scanOrphanFilesBtn?.addEventListener("click", scanOrphanFiles);

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
