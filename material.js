import { db, auth, ADMIN_UID } from "./firebase.js";
import { formatListingDateTime } from "./listing-date.js";

import {
    doc,
    getDoc,
    setDoc,
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


        /* =========================
           FILE
        ========================= */

        const paidDigital = material.condition === "Digital" && (
            material.isFree === false ||
            (material.isFree !== true && Number(material.price) > 0)
        );
        if (paidDigital) {
            if (materialFileSection) materialFileSection.hidden = true;
            if (viewFileBtn) viewFileBtn.style.display = "none";
            await renderDigitalAccess(material, isOwner);
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
            try {
                const token = await currentUser.getIdToken();
                const endpoint = new URL("https://us-central1-book-sahayak.cloudfunctions.net/getWatermarkedDigitalPreview");
                endpoint.searchParams.set("materialId", materialId);
                const response = await fetch(endpoint, {
                    headers: { Authorization: "Bearer " + token },
                    signal: controller.signal
                });
                if (!response.ok) throw new Error(await response.text());
                const previewBlob = await response.blob();
                if (!previewBlob.size) throw new Error("The preview file is empty.");
                const previewUrl = URL.createObjectURL(previewBlob);
                const frame = document.createElement("iframe");
                frame.className = "digital-preview-frame";
                frame.title = "Watermarked resource preview";
                frame.src = previewUrl;
                previewStatus.replaceWith(frame);
                retryButton.remove();
            } catch (error) {
                console.warn("Could not load digital preview:", error);
                previewStatus.textContent = error.name === "AbortError"
                    ? "Preview loading timed out. Please try again."
                    : "Preview could not be loaded: " + (error.message || "please try again.");
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
