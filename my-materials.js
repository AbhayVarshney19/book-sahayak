import { auth, db, storage } from "./firebase.js";
import { formatListingDateTime } from "./listing-date.js";

import {
    ref,
    deleteObject,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
    collection,
    getDocs,
    query,
    where,
    deleteDoc,
    doc,
    updateDoc,
    deleteField,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js";


/* =========================
   HTML ELEMENTS
========================= */

const myMaterialsList =
    document.getElementById("myMaterialsList");

const backBtn =
    document.getElementById("backBtn");

const myMaterialsCount =
    document.getElementById("myMaterialsCount");

const myMaterialsThemeBtn =
    document.getElementById(
        "myMaterialsThemeBtn"
    );

function isPaidDigitalListing(material) {
    return material?.condition === "Digital" && (
        material.isFree === false ||
        (material.isFree !== true && Number(material.price) > 0)
    );
}
const downloadRequestsPanel = document.getElementById("downloadRequestsPanel");
let allDownloadRequests = [];
let allSellerChats = [];
const listingViewCounts = new Map();


/* =========================
   DARK MODE
========================= */

function applyMyMaterialsTheme() {

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

    if (myMaterialsThemeBtn) {

        myMaterialsThemeBtn.textContent =
            isDark
                ? "☀️"
                : "🌙";

    }

}


applyMyMaterialsTheme();


if (myMaterialsThemeBtn) {

    myMaterialsThemeBtn.addEventListener(
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

            myMaterialsThemeBtn.textContent =
                isDark
                    ? "☀️"
                    : "🌙";

        }
    );

}


function createResubmitForm(material, materialId, user, editButton) {
    const form = document.createElement("form");
    form.className = "material-resubmit-form";
    form.hidden = true;
    const isLegacyPhysicalMigration = (material.status || "approved") === "approved" && material.condition && material.condition !== "Digital" && Boolean(material.fileURL);

    const heading = document.createElement("div");
    heading.className = "resubmit-form-heading";
    const headingCopy = document.createElement("div");
    const title = document.createElement("h4");
    title.textContent = "Update your listing";
    const intro = document.createElement("p");
    intro.textContent = isLegacyPhysicalMigration
        ? "Replace the old public attachment with condition photos. The listing stays available."
        : "Make the suggested changes, then send it back for review.";
    if (isLegacyPhysicalMigration) title.textContent = "Add condition photos";
    headingCopy.append(title, intro);
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "resubmit-close-btn";
    closeButton.setAttribute("aria-label", "Close edit form");
    closeButton.textContent = "×";
    heading.append(headingCopy, closeButton);
    form.append(heading);

    const addField = (labelText, control, className = "") => {
        const label = document.createElement("label");
        label.className = `resubmit-field ${className}`.trim();
        const caption = document.createElement("span");
        caption.textContent = labelText;
        label.append(caption, control);
        form.append(label);
        return control;
    };

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.required = true;
    titleInput.maxLength = 120;
    titleInput.value = material.title || "";
    addField("Listing title", titleInput);

    const row = document.createElement("div");
    row.className = "resubmit-field-row";
    form.append(row);
    const addRowField = (labelText, control) => {
        const label = document.createElement("label");
        label.className = "resubmit-field";
        const caption = document.createElement("span");
        caption.textContent = labelText;
        label.append(caption, control);
        row.append(label);
    };

    const categorySelect = document.createElement("select");
    ["Books", "Notes", "PYQs", "Lab Files", "Other"].forEach((category) => {
        categorySelect.add(new Option(category, category));
    });
    if (material.category && ![...categorySelect.options].some((option) => option.value === material.category)) {
        categorySelect.add(new Option(material.category, material.category));
    }
    categorySelect.value = material.category || "Other";
    addRowField("Category", categorySelect);

    const subjectInput = document.createElement("input");
    subjectInput.type = "text";
    subjectInput.required = true;
    subjectInput.maxLength = 80;
    subjectInput.value = material.subject || "";
    addRowField("Subject", subjectInput);

    const contactInput = document.createElement("input");
    contactInput.type = "tel";
    contactInput.inputMode = "numeric";
    contactInput.maxLength = 10;
    contactInput.pattern = "[0-9]{10}";
    contactInput.required = true;
    contactInput.value = material.contactNumber || "";
    addField("Contact number (10 digits)", contactInput);

    const descriptionInput = document.createElement("textarea");
    descriptionInput.rows = 4;
    descriptionInput.maxLength = 1200;
    descriptionInput.required = true;
    descriptionInput.value = material.description || "";
    addField("Description", descriptionInput);

    const priceRow = document.createElement("div");
    priceRow.className = "resubmit-field-row resubmit-price-row";
    form.append(priceRow);

    const priceInput = document.createElement("input");
    priceInput.type = "number";
    priceInput.min = "0";
    priceInput.step = "1";
    priceInput.value = material.isFree ? "" : (material.price ?? "");
    const priceLabel = document.createElement("label");
    priceLabel.className = "resubmit-field";
    const priceCaption = document.createElement("span");
    priceCaption.textContent = "Price (₹)";
    priceLabel.append(priceCaption, priceInput);
    priceRow.append(priceLabel);

    const conditionSelect = document.createElement("select");
    ["New", "Like New", "Good", "Fair", "Digital"].forEach((condition) => {
        conditionSelect.add(new Option(condition, condition));
    });
    if (material.condition && ![...conditionSelect.options].some((option) => option.value === material.condition)) {
        conditionSelect.add(new Option(material.condition, material.condition));
    }
    conditionSelect.value = material.condition || "Digital";
    const conditionLabel = document.createElement("label");
    conditionLabel.className = "resubmit-field";
    const conditionCaption = document.createElement("span");
    conditionCaption.textContent = "Condition";
    conditionLabel.append(conditionCaption, conditionSelect);
    priceRow.append(conditionLabel);

    const freeLabel = document.createElement("label");
    freeLabel.className = "resubmit-free-option";
    const freeInput = document.createElement("input");
    freeInput.type = "checkbox";
    freeInput.checked = Boolean(material.isFree);
    const freeText = document.createElement("span");
    freeText.textContent = "This resource is free";
    freeLabel.append(freeInput, freeText);
    form.append(freeLabel);

    freeInput.addEventListener("change", () => {
        priceInput.disabled = freeInput.checked;
        priceInput.required = !freeInput.checked;
        if (freeInput.checked) priceInput.value = "";
        updateEditFileFields();
    });
    priceInput.disabled = freeInput.checked;
    priceInput.required = !freeInput.checked;

    const fileBlock = document.createElement("div");
    fileBlock.className = "resubmit-file-block";
    const fileInfo = document.createElement("p");
    fileInfo.textContent = material.fileName
        ? `Current file: ${material.fileName}. Leave this blank to keep it.`
        : "Add or replace the resource file (optional).";
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".pdf,.doc,.docx,.ppt,.pptx";
    fileBlock.append(fileInfo, fileInput);
    form.append(fileBlock);

    const conditionPhotoBlock = document.createElement("div");
    conditionPhotoBlock.className = "resubmit-file-block";
    const conditionPhotoInfo = document.createElement("p");
    const existingConditionPhotos = Array.isArray(material.conditionPhotos) ? material.conditionPhotos : [];
    conditionPhotoInfo.textContent = existingConditionPhotos.length
        ? `${existingConditionPhotos.length} condition photo(s) already saved. Choose new photos to replace them.`
        : "Add photos showing the cover, pages, and wear on this physical item.";
    if (isLegacyPhysicalMigration) {
        conditionPhotoInfo.textContent = "Add condition photos. Saving removes the old public file and keeps this listing available.";
    }
    const conditionPhotoInput = document.createElement("input");
    conditionPhotoInput.type = "file";
    conditionPhotoInput.accept = "image/*";
    conditionPhotoInput.multiple = true;
    conditionPhotoBlock.append(conditionPhotoInfo, conditionPhotoInput);
    form.append(conditionPhotoBlock);

    const updateEditFileFields = () => {
        const physical = conditionSelect.value !== "Digital";
        fileBlock.hidden = physical;
        conditionPhotoBlock.hidden = !physical;
        fileInput.required = !physical && !isFreeInputChecked();
        conditionPhotoInput.required = physical && existingConditionPhotos.length === 0;
    };
    const isFreeInputChecked = () => Boolean(form.querySelector(".resubmit-free-option input")?.checked);
    conditionSelect.addEventListener("change", updateEditFileFields);
    updateEditFileFields();
    conditionPhotoInput.addEventListener("change", () => {
        if (conditionPhotoInput.files.length > 5) {
            conditionPhotoInput.value = "";
            conditionPhotoInfo.textContent = "Please choose no more than 5 photos.";
        } else if (conditionPhotoInput.files.length) {
            conditionPhotoInfo.textContent = `${conditionPhotoInput.files.length} new condition photo(s) selected.`;
        }
    });

    const status = document.createElement("p");
    status.className = "resubmit-status";
    status.setAttribute("aria-live", "polite");
    form.append(status);

    const actions = document.createElement("div");
    actions.className = "resubmit-form-actions";
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "resubmit-cancel-btn";
    cancelButton.textContent = "Cancel";
    const submitButton = document.createElement("button");
    submitButton.type = "submit";
    submitButton.className = "resubmit-submit-btn";
    submitButton.textContent = "Resubmit for review";
    actions.append(cancelButton, submitButton);
    form.append(actions);

    const closeForm = () => {
        form.hidden = true;
        editButton.hidden = false;
    };
    closeButton.addEventListener("click", closeForm);
    cancelButton.addEventListener("click", closeForm);
    if (isLegacyPhysicalMigration) {
        form.querySelectorAll("input, select, textarea").forEach((field) => { field.disabled = true; });
        conditionPhotoInput.disabled = false;
        submitButton.textContent = "Save photos & remove old file";
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;

        submitButton.disabled = true;
        cancelButton.disabled = true;
        closeButton.disabled = true;
        status.textContent = "Saving your changes…";

        let replacementRef = null;
        let oldFileRemoved = true;
        const uploadedConditionRefs = [];
        try {
            const data = isLegacyPhysicalMigration ? {
                fileURL: deleteField(),
                fileName: deleteField(),
                storagePath: deleteField()
            } : {
                title: titleInput.value.trim(),
                category: categorySelect.value,
                subject: subjectInput.value.trim(),
                contactNumber: contactInput.value.trim(),
                description: descriptionInput.value.trim(),
                condition: conditionSelect.value,
                price: freeInput.checked ? 0 : Number(priceInput.value),
                isFree: freeInput.checked,
                status: "pending",
                reviewedAt: null,
                reviewedBy: "",
                reviewFeedback: ""
            };

            const file = fileInput.files?.[0];
            const isPhysical = conditionSelect.value !== "Digital";
            const paidDigital = conditionSelect.value === "Digital" && !freeInput.checked;
            const selectedConditionPhotos = [...(conditionPhotoInput.files || [])];
            if (selectedConditionPhotos.length > 5 || selectedConditionPhotos.some((photo) => !photo.type.startsWith("image/") || photo.size > 5 * 1024 * 1024)) {
                throw new Error("Choose up to 5 image files, each no larger than 5 MB.");
            }
            if (isPhysical && !selectedConditionPhotos.length && existingConditionPhotos.length === 0) {
                throw new Error("Add at least one clear condition photo before resubmitting this physical listing.");
            }
            if (paidDigital && (!file || !file.name.toLowerCase().endsWith(".pdf"))) {
                throw new Error("For a paid digital listing, choose the corrected PDF file so a fresh preview can be created.");
            }
            if (file && !isPhysical) {
                const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                replacementRef = ref(
                    storage,
                    paidDigital
                        ? `private-materials/${user.uid}/${materialId}/original.pdf`
                        : `materials/${user.uid}/${Date.now()}_${safeFileName}`
                );
                await uploadBytes(replacementRef, file, {
                    contentType: file.type || "application/octet-stream"
                });
                if (paidDigital) data.fileURL = deleteField();
                else data.fileURL = await getDownloadURL(replacementRef);
                data.storagePath = replacementRef.fullPath;
                data.fileName = file.name;
            }
            if (isPhysical && selectedConditionPhotos.length) {
                const newPhotoUrls = [];
                for (const [index, photo] of selectedConditionPhotos.entries()) {
                    const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                    const photoRef = ref(storage, `materials/${user.uid}/${materialId}/condition-preview/${Date.now()}_${index}_${safeName}`);
                    await uploadBytes(photoRef, photo, { contentType: photo.type });
                    uploadedConditionRefs.push(photoRef);
                    newPhotoUrls.push(await getDownloadURL(photoRef));
                }
                data.conditionPhotos = newPhotoUrls;
            }
            if (isPhysical && !isLegacyPhysicalMigration) {
                data.fileURL = deleteField();
                data.fileName = deleteField();
                data.storagePath = deleteField();
                data.accessMode = deleteField();
                data.previewStatus = deleteField();
                data.previewStoragePath = deleteField();
            } else if (!isPhysical) {
                data.conditionPhotos = deleteField();
            }
            if (paidDigital) {
                data.accessMode = "owner-approval";
                data.previewStatus = "processing";
                data.previewStoragePath = "";
            } else if (material.accessMode === "owner-approval") {
                data.accessMode = deleteField();
                data.previewStatus = deleteField();
                data.previewStoragePath = deleteField();
            }

            await updateDoc(doc(db, "materials", materialId), data);

            if (existingConditionPhotos.length && (selectedConditionPhotos.length || !isPhysical)) {
                for (const oldPhotoUrl of existingConditionPhotos) {
                    try { await deleteObject(ref(storage, oldPhotoUrl)); }
                    catch (cleanupError) { console.warn("Could not remove a replaced condition photo:", cleanupError); }
                }
            }

            if (paidDigital) {
                await httpsCallable(getFunctions(), "preparePaidDigitalPreview")({ materialId });
            }

            if ((replacementRef || isPhysical || isLegacyPhysicalMigration) && material.storagePath && (!replacementRef || replacementRef.fullPath !== material.storagePath)) {
                try {
                    await deleteObject(ref(storage, material.storagePath));
                } catch (cleanupError) {
                    oldFileRemoved = false;
                    console.warn("Could not remove the replaced resource file:", cleanupError);
                }
            }

            alert(isLegacyPhysicalMigration
                ? (oldFileRemoved
                    ? "Condition photos saved and the old shared file removed."
                    : "Condition photos saved, but Firebase could not delete the old file. Remove it from Storage or ask an admin for help.")
                : "Your updated listing has been resubmitted for review.");
            window.location.reload();
        } catch (error) {
            if (replacementRef && replacementRef.fullPath !== material.storagePath) {
                try { await deleteObject(replacementRef); } catch (cleanupError) { console.warn("Could not remove the incomplete replacement upload:", cleanupError); }
            }
            for (const uploadedPhotoRef of uploadedConditionRefs) {
                try { await deleteObject(uploadedPhotoRef); } catch (cleanupError) { console.warn("Could not remove an incomplete condition photo:", cleanupError); }
            }
            console.error("Resubmission error:", error);
            status.textContent = `Could not resubmit: ${error.message}`;
            submitButton.disabled = false;
            cancelButton.disabled = false;
            closeButton.disabled = false;
        }
    });

    return form;
}

function renderDownloadRequests(user, requestDocs) {
    if (!downloadRequestsPanel) return;
    downloadRequestsPanel.replaceChildren();
    allDownloadRequests = requestDocs.map((item) => ({ id: item.id, ...item.data() }));
    if (!requestDocs.length) return;

    const section = document.createElement("section");
    section.className = "download-requests-panel";
    const heading = document.createElement("h2");
    heading.textContent = "Digital download requests";
    section.append(heading);
    requestDocs.forEach((snapshot) => {
        const request = snapshot.data();
        const row = document.createElement("div");
        row.className = "download-request-row";
        const summary = document.createElement("p");
        summary.textContent = `${request.buyerName || "A student"}${request.buyerEmail ? ` · ${request.buyerEmail}` : ""} requested “${request.materialTitle || "your resource"}” — ${request.status}.`;
        row.append(summary);
        if (request.status === "pending") {
            ["approved", "rejected"].forEach((decision) => {
                const button = document.createElement("button");
                button.type = "button";
                button.textContent = decision === "approved" ? "Approve download" : "Decline";
                button.addEventListener("click", async () => {
                    button.disabled = true;
                    try {
                        await updateDoc(doc(db, "downloadRequests", snapshot.id), {
                            status: decision,
                            reviewedBy: user.uid,
                            reviewedAt: serverTimestamp()
                        });
                    } catch (error) {
                        console.error("Could not update download request:", error);
                        button.disabled = false;
                        alert(`Could not update the request: ${error.message}`);
                    }
                });
                row.append(button);
            });
        }
        section.append(row);
    });
    downloadRequestsPanel.append(section);
}

async function loadDownloadRequests(user) {
    const requests = await getDocs(query(
        collection(db, "downloadRequests"),
        where("sellerUid", "==", user.uid)
    ));
    renderDownloadRequests(user, requests.docs);
}

let stopWatchingListingRequests = null;
function watchListingRequests(user) {
    stopWatchingListingRequests?.();
    stopWatchingListingRequests = onSnapshot(
        query(collection(db, "downloadRequests"), where("sellerUid", "==", user.uid)),
        (snapshot) => {
            renderDownloadRequests(user, snapshot.docs);
            document.querySelectorAll(".my-material-card[data-material-id]").forEach((card) => {
                loadListingActivity(card, card.dataset.materialId, user);
            });
        },
        (error) => console.warn("Could not watch download requests:", error)
    );
}
let stopWatchingSellerChats = null;
function watchSellerChats(user) {
    stopWatchingSellerChats?.();
    stopWatchingSellerChats = onSnapshot(
        query(collection(db, "chats"), where("participants", "array-contains", user.uid)),
        (snapshot) => {
            allSellerChats = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
            document.querySelectorAll(".my-material-card[data-material-id]").forEach((card) => {
                loadListingActivity(card, card.dataset.materialId, user);
            });
        },
        (error) => {
            allSellerChats = [];
            console.warn("Could not load listing conversations:", error);
        }
    );
}
async function loadListingActivity(card, materialId, user) {
    const panel = card.querySelector(".listing-activity");
    if (!panel) return;
    try {
        const conversations = allSellerChats.filter((chat) => chat.materialId === materialId && (chat.sellerId === user.uid || (chat.participants || []).includes(user.uid)) && !(chat.hiddenFor || []).includes(user.uid));
        const unread = conversations.reduce((total, chat) => total + Number(chat.unreadCounts?.[user.uid] || 0), 0);
        const pending = allDownloadRequests.filter((request) => request.materialId === materialId && request.status === "pending").length;
        if (!listingViewCounts.has(materialId)) {
            const countPromise = getDocs(collection(db, "materials", materialId, "listingViews")).then((views) => views.size).catch((error) => { console.warn("Could not load listing views:", error); return null; });
            listingViewCounts.set(materialId, countPromise);
        }
        const views = await listingViewCounts.get(materialId);
        panel.replaceChildren();
        const heading = document.createElement("summary");
        heading.textContent = "Activity";
        const stats = document.createElement("span");
        stats.className = "listing-activity-stats";
        stats.textContent = `${views === null ? "Views unavailable" : `${views} unique views`} · ${conversations.length} ${conversations.length === 1 ? "buyer conversation" : "buyer conversations"} · ${unread} unread ${unread === 1 ? "message" : "messages"}${pending ? ` · ${pending} pending file ${pending === 1 ? "request" : "requests"}` : ""}`;
        heading.append(stats);
        panel.append(heading);
        const messageButton = card.querySelector(".messageMaterialBtn");
        if (messageButton) messageButton.textContent = `💬 Messages (${conversations.length})`;
        if (!conversations.length) return;
        const people = document.createElement("ul");
        people.className = "listing-contact-list";
        conversations.sort((a, b) => String(a.buyerName || "").localeCompare(String(b.buyerName || ""))).forEach((chat) => {
            const item = document.createElement("li");
            const identity = document.createElement("span");
            const name = document.createElement("strong");
            name.textContent = chat.buyerName || "Buyer";
            const email = document.createElement("span");
            email.className = "listing-contact-email";
            email.textContent = chat.buyerEmail || "Email appears when the buyer next opens this chat";
            identity.append(name, email);
            const link = document.createElement("a");
            const buyerId = chat.buyerId || (chat.participants || []).find((participantId) => participantId !== user.uid) || "";
            link.href = `chat.html?user=${encodeURIComponent(buyerId)}&material=${encodeURIComponent(materialId)}`;
            link.textContent = "Open chat";
            item.append(identity, link);
            people.append(item);
        });
        panel.append(people);
    } catch (error) {
        console.warn("Could not load listing activity:", error);
        panel.textContent = "Listing activity is temporarily unavailable.";
    }
}
/* =========================
   SHOW EMPTY STATE
========================= */

function showEmptyState() {

    myMaterialsList.innerHTML = `

        <div class="my-materials-empty">

            <div class="my-materials-empty-icon">
                📚
            </div>

            <h3>
                No materials yet
            </h3>

            <p>
                You haven't uploaded any study
                materials yet.
            </p>

            <button
                type="button"
                onclick="window.location.href='upload.html'"
            >
                Upload Material
            </button>

        </div>

    `;

}


/* =========================
   LOAD MY MATERIALS
========================= */

onAuthStateChanged(
    auth,
    async (user) => {

        if (!user) {

            window.location.href =
                "index.html";

            return;

        }


        try {

            await loadDownloadRequests(user);
            watchListingRequests(user);
            watchSellerChats(user);

            /* =========================
               GET USER MATERIALS
            ========================= */

            const materialsQuery =
                query(
                    collection(
                        db,
                        "materials"
                    ),
                    where(
                        "uploadedBy",
                        "==",
                        user.uid
                    )
                );


            const querySnapshot =
                await getDocs(
                    materialsQuery
                );


            myMaterialsList.innerHTML =
                "";


            /* =========================
               NO MATERIALS
            ========================= */

            if (querySnapshot.empty) {

                myMaterialsCount.textContent =
                    "0 materials";

                showEmptyState();

                return;

            }


            /* =========================
               MATERIAL COUNT
            ========================= */

            myMaterialsCount.textContent =
                querySnapshot.size +
                (
                    querySnapshot.size === 1
                        ? " material"
                        : " materials"
                );


            /* =========================
               CREATE MATERIAL CARDS
            ========================= */

            querySnapshot.forEach(
                (docSnapshot) => {

                    const material =
                        docSnapshot.data();

                    const materialId =
                        docSnapshot.id;

                    const reviewStatus =
                        material.status ||
                        "approved";


                    const materialDiv =
                        document.createElement(
                            "div"
                        );


                    materialDiv.className =
                        "my-material-card";
                    materialDiv.dataset.materialId = materialId;


                    /* =========================
                       CARD HTML
                    ========================= */

                    materialDiv.innerHTML = `

                        <div class="my-material-card-top">

                            <div class="my-material-icon">
                                📖
                            </div>

                            <span class="my-material-badge">
                                YOUR UPLOAD
                            </span>

                            <span class="my-material-status status-${escapeHTML(reviewStatus)}">
                                ${escapeHTML(
                                    reviewStatus === "pending"
                                        ? "PENDING REVIEW"
                                        : reviewStatus.toUpperCase()
                                )}
                            </span>

                        </div>


                        <h3>
                            ${escapeHTML(
                                material.title ||
                                "Untitled Material"
                            )}
                        </h3>


                        <p class="my-material-subject">
                            Subject:
                            ${escapeHTML(
                                material.subject ||
                                "Not specified"
                            )}
                        </p>

                        <p class="my-material-posted">
                            🕒 Posted ${escapeHTML(formatListingDateTime(material.createdAt))}
                        </p>

                        <p class="my-material-description">
                            ${escapeHTML(
                                material.description ||
                                "No description provided."
                            )}
                        </p>

                        ${
                            reviewStatus === "pending"
                                ? `
                                    <p class="my-material-review-note pending-note">
                                        This listing is waiting for admin review.
                                    </p>
                                `
                                : reviewStatus === "rejected"
                                    ? `
                                        <div class="my-material-review-note rejected-note">
                                            <strong>Changes requested</strong>
                                            <p>${escapeHTML(
                                                material.reviewFeedback ||
                                                "Please review and improve the listing details before submitting it again."
                                            )}</p>
                                            <span>This listing stays hidden until it is approved.</span>
                                        </div>
                                    `
                                    : ""
                        }


                        <details class="listing-activity"><summary>Loading listing activity…</summary></details>

                        <div class="my-material-actions">

                            <button
                                type="button"
                                class="viewMaterialBtn"
                            >
                                View Material
                            </button>


                            <button
                                type="button"
                                class="messageMaterialBtn"
                            >
                                💬 Messages
                            </button>

                            ${
                                reviewStatus === "rejected" || (material.condition && material.condition !== "Digital" && material.fileURL)
                                    ? `
                                        <button type="button" class="editResubmitBtn">
                                            ✎ ${reviewStatus === "rejected" ? "Edit & resubmit" : "Update photos & remove file"}
                                        </button>
                                    `
                                    : ""
                            }

                            ${
                                isPaidDigitalListing(material) && material.accessMode !== "owner-approval"
                                    ? `<button type="button" class="secureDigitalBtn">🔒 Secure file</button>`
                                    : isPaidDigitalListing(material) && material.previewStatus !== "ready" && (material.previewStatus === "failed" || material.fileName?.toLowerCase().endsWith(".pdf"))
                                        ? `<button type="button" class="retryPreviewBtn">↻ Prepare preview</button>`
                                        : ""
                            }


                            <button
                                type="button"
                                class="deleteMaterialBtn"
                            >
                                Delete
                            </button>

                        </div>

                    `;


                    /* =========================
                       VIEW MATERIAL
                    ========================= */

                    const viewButton =
                        materialDiv.querySelector(
                            ".viewMaterialBtn"
                        );


                    viewButton.addEventListener(
                        "click",
                        () => {

                            window.location.href =
                                "material.html?id=" +
                                encodeURIComponent(
                                    materialId
                                );

                        }
                    );

                    const secureButton = materialDiv.querySelector(".secureDigitalBtn");
                    const previewButton = materialDiv.querySelector(".retryPreviewBtn");
                    const processDigitalFile = async (button, callableName) => {
                        button.disabled = true;
                        button.textContent = "Securing file…";
                        try {
                            await httpsCallable(getFunctions(), callableName)({ materialId });
                            window.location.reload();
                        } catch (error) {
                            console.error("Could not secure digital resource:", error);
                            button.disabled = false;
                            button.textContent = "Could not secure file — retry";
                            alert(error.message || "Could not secure this file.");
                        }
                    };
                    secureButton?.addEventListener("click", () => processDigitalFile(secureButton, "secureLegacyPaidDigitalResource"));
                    previewButton?.addEventListener("click", () => processDigitalFile(previewButton, "preparePaidDigitalPreview"));


                    /* Open the chat group for this listing rather than choosing an arbitrary buyer. */
                    const messageButton = materialDiv.querySelector(".messageMaterialBtn");
                    messageButton.addEventListener("click", () => {
                        window.location.href = `chats.html?material=${encodeURIComponent(materialId)}`;
                    });
                    /* =========================
                       DELETE MATERIAL
                    ========================= */

                    const deleteButton =
                        materialDiv.querySelector(
                            ".deleteMaterialBtn"
                        );


                    deleteButton.addEventListener(
                        "click",
                        async () => {

                            const confirmDelete =
                                confirm(
                                    "Are you sure you want to delete this material?"
                                );


                            if (!confirmDelete) {

                                return;

                            }


                            try {

                                /* =========================
                                   DELETE STORAGE FILE
                                ========================= */

                                if (
                                    material.storagePath &&
                                    material.storagePath.trim() !== ""
                                ) {

                                    const fileRef =
                                        ref(
                                            storage,
                                            material.storagePath
                                        );


                                    try {

                                        await deleteObject(
                                            fileRef
                                        );

                                    } catch (
                                        storageError
                                    ) {

                                        /*
                                         * If the file is
                                         * already missing,
                                         * continue deleting
                                         * the Firestore document.
                                         */

                                        if (
                                            storageError.code !==
                                            "storage/object-not-found"
                                        ) {

                                            throw storageError;

                                        }

                                    }

                                }


                                /* =========================
                                   DELETE FIRESTORE DOCUMENT
                                ========================= */

                                await deleteDoc(
                                    doc(
                                        db,
                                        "materials",
                                        materialId
                                    )
                                );


                                /* =========================
                                   REMOVE CARD
                                ========================= */

                                materialDiv.remove();


                                /* =========================
                                   UPDATE COUNT
                                ========================= */

                                const remaining =
                                    myMaterialsList.querySelectorAll(
                                        ".my-material-card"
                                    ).length;


                                myMaterialsCount.textContent =
                                    remaining +
                                    (
                                        remaining === 1
                                            ? " material"
                                            : " materials"
                                    );


                                /* =========================
                                   SHOW EMPTY STATE
                                ========================= */

                                if (
                                    remaining === 0
                                ) {

                                    showEmptyState();

                                }

                            } catch (error) {

                                console.error(
                                    "Delete error:",
                                    error
                                );


                                alert(
                                    "Could not delete material: " +
                                    error.message
                                );

                            }

                        }
                    );


                    if (reviewStatus === "rejected") {
                        const editButton = materialDiv.querySelector(".editResubmitBtn");
                        const resubmitForm = createResubmitForm(
                            material,
                            materialId,
                            user,
                            editButton
                        );

                        editButton.addEventListener("click", () => {
                            editButton.hidden = true;
                            resubmitForm.hidden = false;
                            resubmitForm.querySelector("input")?.focus();
                        });

                        materialDiv.appendChild(resubmitForm);
                    }


                    /* =========================
                       ADD CARD
                    ========================= */

                    myMaterialsList.appendChild(
                        materialDiv
                    );

                    loadListingActivity(materialDiv, materialId, user);

                }
            );


        } catch (error) {

            console.error(
                "Error loading materials:",
                error
            );


            myMaterialsCount.textContent =
                "Unable to load";


            myMaterialsList.innerHTML = `

                <div class="my-materials-empty">

                    <div class="my-materials-empty-icon">
                        ⚠️
                    </div>

                    <h3>
                        Could not load materials
                    </h3>

                    <p>
                        Please refresh the page and try again.
                    </p>

                </div>

            `;

        }

    }
);


/* =========================
   ESCAPE HTML
========================= */

function escapeHTML(value) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        String(value);

    return div.innerHTML;

}


/* =========================
   BACK TO HOME
========================= */

if (backBtn) {

    backBtn.addEventListener(
        "click",
        () => {

            window.location.href =
                "home.html";

        }
    );

}
