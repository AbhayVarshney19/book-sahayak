import { db, auth, ADMIN_UID } from "./firebase.js";
import { formatListingDateTime } from "./listing-date.js";
import { recordRecentListing } from "./recent-listings.js";

import {
    doc,
    getDoc,
    setDoc,
    addDoc,
    collection,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";


/* =========================
   GET MATERIAL ID
========================= */

const params =
    new URLSearchParams(
        window.location.search
    );

const materialId =
    params.get("id");


/* =========================
   GET HTML ELEMENTS
========================= */

const title =
    document.getElementById(
        "materialTitle"
    );

const subject =
    document.getElementById(
        "materialSubject"
    );

const description =
    document.getElementById(
        "materialDescription"
    );

const materialPrice =
    document.getElementById(
        "materialPrice"
    );

const uploader =
    document.getElementById(
        "materialUploader"
    );

const viewFileBtn =
    document.getElementById(
        "viewFileBtn"
    );

const backBtn =
    document.getElementById(
        "backBtn"
    );

const messageSellerBtn =
    document.getElementById(
        "messageSellerBtn"
    );
const digitalAccessPanel = document.getElementById("digitalAccessPanel");
const materialPostedAt = document.getElementById("materialPostedAt");
const materialFileSection = viewFileBtn?.closest(".material-file-section");
const conditionPreviewPanel = document.getElementById("conditionPreviewPanel");
const conditionPreviewGallery = document.getElementById("conditionPreviewGallery");
const conditionPreviewNote = document.getElementById("conditionPreviewNote");
const listingReportPanel = document.getElementById("listingReportPanel");
const listingReportForm = document.getElementById("listingReportForm");
const listingReportStatus = document.getElementById("listingReportStatus");
const blockSellerBtn = document.getElementById("blockSellerBtn");
const blockSellerStatus = document.getElementById("blockSellerStatus");
let materialOwnerId = "";


/* =========================
   CURRENT USER
========================= */

let currentUser = null;


/* =========================
   LOAD MATERIAL
========================= */

async function loadMaterial() {

    if (!materialId) {

        title.textContent =
            "Material not found.";

        return;
    }


    try {

        console.log(
            "Loading material:",
            materialId
        );


        /* =========================
           GET MATERIAL
        ========================= */

        const materialRef =
            doc(
                db,
                "materials",
                materialId
            );


        const materialDoc =
            await getDoc(
                materialRef
            );


        if (!materialDoc.exists()) {

            title.textContent =
                "Material not found.";

            return;
        }


        const material =
            materialDoc.data();
        materialOwnerId = material.uploadedBy || "";

        const isOwner =
            currentUser &&
            material.uploadedBy ===
            currentUser.uid;

        const isAdmin =
            currentUser &&
            currentUser.uid === ADMIN_UID;

        if (
            (material.status === "pending" ||
                material.status === "rejected") &&
            !isOwner &&
            !isAdmin
        ) {

            title.textContent =
                "Material not available.";

            return;

        }


        console.log(
            "Material loaded:",
            material
        );

        if (material.status === "approved" && !isOwner && !isAdmin) {
            recordRecentListing(currentUser.uid, materialId);
            setDoc(doc(db, "materials", materialId, "listingViews", currentUser.uid), { viewerUid: currentUser.uid, viewedAt: serverTimestamp() }, { merge: true }).catch((error) => console.warn("Could not record listing view:", error));
        }

        /* =========================
           TITLE
        ========================= */

        if (title) {

            title.textContent =
                material.title ||
                "Untitled Material";

        }


        if (materialPostedAt) {
            materialPostedAt.textContent = "🕒 Posted " + formatListingDateTime(material.createdAt);
        }


        /* =========================
           SUBJECT
        ========================= */

        if (subject) {

            subject.textContent =
                material.subject ||
                "Not specified";

        }


        /* =========================
           DESCRIPTION
        ========================= */

        if (description) {

            description.textContent =
                material.description ||
                "No description available.";

        }


        /* =========================
           PRICE / AVAILABILITY
        ========================= */

        if (materialPrice) {

            if (material.isFree) {

                materialPrice.textContent =
                    "FREE";

                materialPrice.classList.add(
                    "material-free"
                );

                materialPrice.classList.remove(
                    "material-paid"
                );

            }

            else if (
                material.price !== undefined &&
                material.price !== null &&
                material.price !== ""
            ) {

                materialPrice.textContent =
                    "₹" +
                    material.price;

                materialPrice.classList.add(
                    "material-paid"
                );

                materialPrice.classList.remove(
                    "material-free"
                );

            }

            else {

                materialPrice.textContent =
                    "Price not specified";

                materialPrice.classList.remove(
                    "material-free"
                );

                materialPrice.classList.remove(
                    "material-paid"
                );

            }

        }


        /* =========================
           UPLOADER
        ========================= */

        if (listingReportPanel) listingReportPanel.hidden = isOwner || isAdmin;
        if (blockSellerBtn) blockSellerBtn.hidden = !currentUser || !materialOwnerId || isOwner || isAdmin;

        if (uploader) {

            uploader.innerHTML = "";


            const sellerName =
                document.createElement(
                    "div"
                );


            sellerName.className =
                "seller-name";


            sellerName.textContent =
                "👤 " +
                (
                    material.uploaderName ||
                    "Student"
                );


            uploader.appendChild(
                sellerName
            );

        }


        /* =========================
           MESSAGE SELLER
        ========================= */

        if (messageSellerBtn) {

            /*
             * uploadedBy is the Firebase UID
             * of the person who uploaded
             * this material.
             */

            const sellerId =
                material.uploadedBy;


            /*
             * If seller ID doesn't exist,
             * hide the button.
             */

            if (!sellerId) {

                messageSellerBtn.style.display =
                    "none";

            }

            /*
             * Don't allow the seller
             * to message themselves.
             */

            else if (
                currentUser &&
                currentUser.uid === sellerId
            ) {

                messageSellerBtn.style.display =
                    "none";

            }

            else {

                messageSellerBtn.style.display =
                    "inline-flex";


                messageSellerBtn.onclick =
                    function () {

                        window.location.href =
                            "chat.html?user=" +
                            encodeURIComponent(
                                sellerId
                            ) +
                            "&material=" +
                            encodeURIComponent(
                                materialId
                            );

                    };

            }

        }


        if (blockSellerBtn && !blockSellerBtn.hidden) await updateBlockButton();

        /* =========================
           FILE
        ========================= */

        const materialCondition = material.condition || "Digital";
        const paidDigital = materialCondition === "Digital" && (
            material.isFree === false ||
            (material.isFree !== true && Number(material.price) > 0)
        );
        if (paidDigital) {
            if (materialFileSection) materialFileSection.hidden = true;
            if (viewFileBtn) viewFileBtn.style.display = "none";
            await renderDigitalAccess(material, isOwner);
        } else if (materialCondition !== "Digital") {
            if (materialFileSection) materialFileSection.hidden = true;
            if (viewFileBtn) viewFileBtn.style.display = "none";
            renderConditionPreview(material);
        } else if (viewFileBtn) {
            if (materialFileSection) materialFileSection.hidden = false;

            if (material.fileURL) {

                viewFileBtn.href =
                    material.fileURL;

                viewFileBtn.textContent =
                    "View / Download";

                viewFileBtn.style.display =
                    "inline-flex";

            }

            else {

                viewFileBtn.style.display =
                    "none";

            }

        }


    }

    catch (error) {

        console.error(
            "Error loading material:",
            error
        );


        if (title) {

            title.textContent =
                "Could not load material.";

        }


        if (subject) {

            subject.textContent =
                "";

        }


        if (description) {

            description.textContent =
                "";

        }


        if (uploader) {

            uploader.textContent =
                "";

        }


        if (messageSellerBtn) {

            messageSellerBtn.style.display =
                "none";

        }

    }

}

function renderConditionPreview(material) {
    if (!conditionPreviewPanel || !conditionPreviewGallery) return;
    conditionPreviewPanel.hidden = false;
    conditionPreviewGallery.replaceChildren();
    const photos = Array.isArray(material.conditionPhotos)
        ? material.conditionPhotos.filter((url) => typeof url === "string" && url.startsWith("https://"))
        : [];
    if (!photos.length) {
        conditionPreviewNote.textContent = "The seller has not added condition photos yet. Message them to ask about the item's condition and arrange physical handover.";
        return;
    }
    conditionPreviewNote.textContent = "Preview the item's condition. The physical item is handed over by the seller; no full-file download is provided.";
    photos.slice(0, 5).forEach((url, index) => {
        const link = document.createElement("a");
        link.className = "condition-preview-photo";
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute("aria-label", `Open condition photo ${index + 1} in a new tab`);
        const image = document.createElement("img");
        image.src = url;
        image.alt = `Physical resource condition photo ${index + 1}`;
        image.loading = "lazy";
        link.append(image);
        conditionPreviewGallery.append(link);
    });
}

async function renderDigitalAccess(material, isOwner) {
    if (!digitalAccessPanel) return;
    digitalAccessPanel.hidden = false;
    digitalAccessPanel.innerHTML = "";
    const heading = document.createElement("h3");
    heading.textContent = "Digital resource preview";
    const note = document.createElement("p");
    note.textContent = "Only a short watermarked preview is shown here. The full file is available after the owner approves your request.";
    digitalAccessPanel.append(heading, note);

    if (material.accessMode !== "owner-approval") {
        const legacy = document.createElement("p");
        legacy.textContent = isOwner
            ? "This older listing still has a public file link. Open My Materials and choose Secure file to protect it before buyers access it."
            : "The owner is updating access protection for this older resource. Contact the seller before requesting the file.";
        digitalAccessPanel.append(legacy);
        return;
    }

    if (material.previewStatus === "ready" && material.previewStoragePath) {
        const previewStatus = document.createElement("p");
        previewStatus.textContent = "Loading the protected preview…";
        digitalAccessPanel.append(previewStatus);
        const retryButton = document.createElement("button");
        retryButton.type = "button";
        retryButton.className = "material-view-btn";
        retryButton.textContent = "Retry preview";
        retryButton.hidden = true;
        digitalAccessPanel.append(retryButton);
        retryButton.addEventListener("click", loadPreview);
        async function loadPreview() {
            retryButton.disabled = true;
            retryButton.hidden = true;
            previewStatus.textContent = "Loading the protected preview…";
            const controller = new AbortController();
            const timeout = window.setTimeout(() => controller.abort(), 45_000);
            let previewBytes = null;
            try {
                const token = await currentUser.getIdToken();
                const endpoint = new URL("https://us-central1-book-sahayak.cloudfunctions.net/getWatermarkedDigitalPreview");
                endpoint.searchParams.set("materialId", materialId);
                const response = await fetch(endpoint, {
                    headers: { Authorization: "Bearer " + token },
                    signal: controller.signal
                });
                if (!response.ok) throw new Error(await response.text());
                previewBytes = new Uint8Array(await response.arrayBuffer());
                if (!previewBytes.length) throw new Error("The preview file is empty.");

                // Canvas rendering works on mobile browsers that cannot display PDF blob URLs in an iframe.
                const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs");
                pdfjs.GlobalWorkerOptions.workerSrc =
                    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
                const pdf = await pdfjs.getDocument({ data: previewBytes }).promise;
                const pages = document.createElement("div");
                pages.className = "digital-preview-pages";
                const pageCount = Math.min(pdf.numPages, 3);

                for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
                    const page = await pdf.getPage(pageNumber);
                    const baseViewport = page.getViewport({ scale: 1 });
                    const availableWidth = Math.max(240, digitalAccessPanel.clientWidth - 44);
                    const viewport = page.getViewport({ scale: Math.min(1.5, availableWidth / baseViewport.width) });
                    const outputScale = Math.min(window.devicePixelRatio || 1, 2);
                    const pageCard = document.createElement("div");
                    pageCard.className = "digital-preview-page";
                    const pageLabel = document.createElement("span");
                    pageLabel.textContent = `Preview · page ${pageNumber} of ${pageCount}`;
                    const canvas = document.createElement("canvas");
                    canvas.setAttribute("aria-label", `Watermarked preview page ${pageNumber}`);
                    canvas.width = Math.ceil(viewport.width * outputScale);
                    canvas.height = Math.ceil(viewport.height * outputScale);
                    canvas.style.width = `${viewport.width}px`;
                    canvas.style.height = `${viewport.height}px`;
                    pageCard.append(pageLabel, canvas);
                    pages.append(pageCard);
                    await page.render({
                        canvasContext: canvas.getContext("2d", { alpha: false }),
                        viewport,
                        ...(outputScale > 1 ? { transform: [outputScale, 0, 0, outputScale, 0, 0] } : {})
                    }).promise;
                }

                previewStatus.replaceWith(pages);
                retryButton.remove();
            } catch (error) {
                console.warn("Could not load digital preview:", error);
                previewStatus.textContent = error.name === "AbortError"
                    ? "Preview loading timed out. Please try again."
                    : "Preview could not be rendered here. Please retry or open the PDF preview in a new tab.";
                if (previewBytes?.length) {
                    const fallbackLink = document.createElement("a");
                    fallbackLink.className = "digital-preview-fallback";
                    fallbackLink.href = URL.createObjectURL(new Blob([previewBytes], { type: "application/pdf" }));
                    fallbackLink.target = "_blank";
                    fallbackLink.rel = "noopener noreferrer";
                    fallbackLink.textContent = "Open preview PDF";
                    previewStatus.after(fallbackLink);
                }
                retryButton.hidden = false;
                retryButton.disabled = false;
            } finally {
                window.clearTimeout(timeout);
            }
        }
        loadPreview();
    } else {
        const processing = document.createElement("p");
        processing.textContent = material.previewStatus === "unavailable-format"
            ? "A browser preview is not available for this document format. Message the seller to discuss access."
            : "The seller's preview is being prepared.";
        digitalAccessPanel.append(processing);
    }

    if (isOwner) {
        const ownerNote = document.createElement("p");
        ownerNote.textContent = "You own this listing. Manage buyer requests from My Materials.";
        digitalAccessPanel.append(ownerNote);
        appendDownloadButton(material);
        return;
    }

    if (!currentUser || !material.uploadedBy) return;
    const requestId = `${materialId}_${currentUser.uid}`;
    const requestRef = doc(db, "downloadRequests", requestId);
    let existing;
    try {
        existing = await getDoc(requestRef);
    } catch (error) {
        console.error("Could not read this buyer's download request:", error);
        const requestError = document.createElement("p");
        requestError.textContent = "Could not check your access request. Refresh the page or contact support.";
        digitalAccessPanel.append(requestError);
        return;
    }
    const requestData = existing.exists() ? existing.data() : null;
    if (requestData?.status === "approved") {
        const approved = document.createElement("p");
        approved.textContent = "The seller approved your request. You can download the original file now.";
        digitalAccessPanel.append(approved);
        appendDownloadButton(material);
        return;
    }
    if (requestData?.status === "pending") {
        const pending = document.createElement("p");
        pending.textContent = "Your download request is waiting for the seller.";
        digitalAccessPanel.append(pending);
        return;
    }
    const requestButton = document.createElement("button");
    requestButton.type = "button";
    requestButton.className = "material-view-btn";
    requestButton.textContent = requestData?.status === "rejected" ? "Request access again" : "Request full file";
    requestButton.addEventListener("click", async () => {
        requestButton.disabled = true;
        try {
            await setDoc(requestRef, {
                materialId,
                materialTitle: material.title || "Digital resource",
                buyerUid: currentUser.uid,
                buyerName: currentUser.displayName || currentUser.email || "Student",
                buyerEmail: currentUser.email || "",
                sellerUid: material.uploadedBy,
                status: "pending",
                reviewedBy: "",
                reviewedAt: null,
                createdAt: serverTimestamp()
            }, { merge: true });
            requestButton.textContent = "Request sent";
        } catch (error) {
            console.error("Could not request resource:", error);
            requestButton.disabled = false;
            requestButton.textContent = "Could not send — try again";
        }
    });
    digitalAccessPanel.append(requestButton);
}

function appendDownloadButton(material) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "material-view-btn";
    button.textContent = "Download full resource";
    button.addEventListener("click", async () => {
        button.disabled = true;
        button.textContent = "Preparing download…";
        try {
            const token = await auth.currentUser.getIdToken();
            const endpoint = new URL("https://us-central1-book-sahayak.cloudfunctions.net/downloadApprovedDigitalResource");
            endpoint.searchParams.set("materialId", materialId);
            const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
            if (!response.ok) throw new Error(await response.text());
            const blobUrl = URL.createObjectURL(await response.blob());
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = material.fileName || "study-resource.pdf";
            document.body.append(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
            button.textContent = "Download started";
        } catch (error) {
            console.error("Protected download failed:", error);
            button.disabled = false;
            button.textContent = error.message || "Download failed — try again";
        }
    });
    digitalAccessPanel.append(button);
}


/* =========================
   BACK BUTTON
========================= */

if (backBtn) {

    backBtn.addEventListener(
        "click",
        function () {

            window.location.href =
                "home.html";

        }
    );

}


/* =========================
   CHECK LOGIN
========================= */

listingReportForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser || !materialId) return;
    const reason = document.getElementById("listingReportReason").value;
    const details = document.getElementById("listingReportDetails").value.trim();
    const submit = document.getElementById("submitListingReport");
    submit.disabled = true; listingReportStatus.textContent = "Sending report…";
    try {
        const listing = await getDoc(doc(db, "materials", materialId));
        if (!listing.exists()) throw new Error("This listing is no longer available.");
        await addDoc(collection(db, "reports"), { materialId, materialTitle: title?.textContent || "Study resource", reportedOwnerUid: listing.data().uploadedBy || "", reportedBy: currentUser.uid, reason, details, status: "open", createdAt: serverTimestamp() });
        listingReportStatus.textContent = "Thank you. Your report has been sent for review."; listingReportForm.reset();
        window.setTimeout(() => { if (listingReportPanel) listingReportPanel.open = false; }, 1800);
    } catch (error) { console.error("Could not send listing report:", error); listingReportStatus.textContent = "Could not send the report. Please try again."; }
    finally { submit.disabled = false; }
});

async function updateBlockButton() {
    if (!currentUser || !materialOwnerId || !blockSellerBtn) return;
    try {
        const block = await getDoc(doc(db, "users", currentUser.uid, "blockedUsers", materialOwnerId));
        const isBlocked = block.exists();
        blockSellerBtn.textContent = isBlocked ? "Unblock seller" : "Block seller";
        if (messageSellerBtn) messageSellerBtn.style.display = isBlocked ? "none" : "inline-flex";
        if (blockSellerStatus) blockSellerStatus.textContent = isBlocked ? "Messages with this seller are blocked." : "";
    } catch (error) { console.warn("Could not check block status:", error); }
}
blockSellerBtn?.addEventListener("click", async () => {
    if (!currentUser || !materialOwnerId) return;
    const blocked = blockSellerBtn.textContent.toLowerCase().includes("unblock");
    if (!window.confirm(blocked ? "Unblock this seller and allow messages again?" : "Block this seller from messaging you?")) return;
    blockSellerBtn.disabled = true;
    try {
        const blockRef = doc(db, "users", currentUser.uid, "blockedUsers", materialOwnerId);
        if (blocked) await deleteDoc(blockRef);
        else await setDoc(blockRef, { blockedUid: materialOwnerId, createdAt: serverTimestamp() });
        await updateBlockButton();
    } catch (error) { console.error("Could not update seller block:", error); if (blockSellerStatus) blockSellerStatus.textContent = "Could not update this block. Please try again."; }
    finally { blockSellerBtn.disabled = false; }
});

onAuthStateChanged(
    auth,
    function (user) {

        if (!user) {

            window.location.href =
                "index.html";

            return;
        }


        currentUser =
            user;


        loadMaterial();

    }
);
