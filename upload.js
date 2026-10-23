import { storage, db, auth } from "./firebase.js";

import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js";

import {
    collection,
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";


let currentUser = null;


/* AUTH */

onAuthStateChanged(auth, (user) => {

    if (!user) {
        window.location.href = "index.html";
        return;
    }

    currentUser = user;

});


/* ELEMENTS */

const message =
    document.getElementById("message");

const submitListingBtn =
    document.getElementById("submitListingBtn");

const backBtn =
    document.getElementById("backBtn");

const themeBtn =
    document.getElementById("themeBtn");

const logoutBtn =
    document.getElementById("logoutBtn");

const isFree =
    document.getElementById("isFree");

const price =
    document.getElementById("price");

const fileInput =
    document.getElementById("file");

const fileUpload =
    document.querySelector(".file-upload");

const fileIcon =
    document.getElementById("fileIcon");

const fileLabel =
    document.getElementById("fileLabel");

const fileHint =
    document.getElementById("fileHint");
const conditionSelect = document.getElementById("condition");
const conditionPhotosInput = document.getElementById("conditionPhotos");
const conditionPhotosSection = document.getElementById("conditionPhotosSection");
const conditionPhotosLabel = document.getElementById("conditionPhotosLabel");
const resourceFileSection = fileUpload?.closest(".form-section");

function updateResourceInputs() {
    const isDigital = conditionSelect?.value === "Digital";
    if (resourceFileSection) resourceFileSection.hidden = !isDigital;
    if (conditionPhotosSection) conditionPhotosSection.hidden = isDigital;
    if (fileInput) fileInput.required = isDigital && !isFree?.checked;
    if (conditionPhotosInput) conditionPhotosInput.required = !isDigital;
}

conditionSelect?.addEventListener("change", updateResourceInputs);
updateResourceInputs();
conditionPhotosInput?.addEventListener("change", () => {
    const photos = [...conditionPhotosInput.files];
    if (photos.length > 5) {
        conditionPhotosInput.value = "";
        conditionPhotosLabel.textContent = "Choose up to 5 photos";
        message.textContent = "Please select no more than 5 condition photos.";
        return;
    }
    conditionPhotosLabel.textContent = photos.length
        ? `${photos.length} condition photo${photos.length === 1 ? "" : "s"} selected`
        : "Choose up to 5 photos";
});


/* FILE PICKER FEEDBACK */

function formatFileSize(bytes) {

    if (bytes < 1024 * 1024) {
        return Math.ceil(bytes / 1024) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(1) + " MB";

}


if (fileInput) {

    fileInput.addEventListener("change", () => {

        const selectedFile = fileInput.files[0];

        if (!selectedFile) {
            return;
        }

        fileUpload?.classList.add("file-selected");

        if (fileIcon) {
            fileIcon.textContent = "✓";
        }

        if (fileLabel) {
            fileLabel.textContent = selectedFile.name;
        }

        if (fileHint) {
            fileHint.textContent =
                formatFileSize(selectedFile.size) +
                " selected — click to change";
        }

    });

}


/* DARK MODE */

const savedTheme =
    localStorage.getItem("bookSahayakTheme");

if (savedTheme === "dark") {

    document.body.classList.add("dark-mode");

    if (themeBtn) {
        themeBtn.textContent = "☀️ Light";
    }

}


if (themeBtn) {

    themeBtn.addEventListener("click", () => {

        document.body.classList.toggle("dark-mode");

        const isDark =
            document.body.classList.contains("dark-mode");

        localStorage.setItem(
            "bookSahayakTheme",
            isDark ? "dark" : "light"
        );

        themeBtn.textContent =
            isDark ? "☀️ Light" : "🌙 Dark";

    });

}


/* LOGOUT */

if (logoutBtn) {

    logoutBtn.addEventListener("click", async () => {

        try {

            await signOut(auth);

            window.location.href = "index.html";

        } catch (error) {

            console.log(error);

        }

    });

}


/* FREE CHECKBOX */

if (isFree) {

    isFree.addEventListener("change", () => {

        if (isFree.checked) {

            price.value = "";
            price.disabled = true;

        } else {

            price.disabled = false;

        }
        updateResourceInputs();

    });

}


/* PUBLISH LISTING */

if (submitListingBtn) {

    submitListingBtn.addEventListener("click", async () => {

        if (!currentUser) {

            message.textContent =
                "Please wait for login to finish.";

            return;

        }


        const title =
            document.getElementById("title").value.trim();

        const category =
            document.getElementById("category").value;

        const subject =
            document.getElementById("subject").value.trim();

        const contactNumber =
            document.getElementById("contactNumber").value.trim();

        const description =
            document.getElementById("description").value.trim();

        const condition =
            document.getElementById("condition").value;
        const conditionPhotos = [...(conditionPhotosInput?.files || [])];

        const fileInput =
            document.getElementById("file");

        const file =
            fileInput.files[0];


        /* VALIDATION */

        if (!title) {

            message.textContent =
                "Please enter a title.";

            return;

        }


        if (!category) {

            message.textContent =
                "Please select a category.";

            return;

        }


        if (!subject) {

            message.textContent =
                "Please enter the subject.";

            return;

        }


        if (!contactNumber) {

            message.textContent =
                "Please enter your contact number.";

            return;

        }


        if (!/^[0-9]{10}$/.test(contactNumber)) {

            message.textContent =
                "Please enter a valid 10-digit contact number.";

            return;

        }


        if (!description) {

            message.textContent =
                "Please enter a description.";

            return;

        }


        if (!condition) {

            message.textContent =
                "Please select the condition.";

            return;

        }


        if (!isFree.checked && (!price.value || Number(price.value) <= 0)) {

            message.textContent =
                "Please enter a price or select Free.";

            return;

        }

        const paidDigital = condition === "Digital" && !isFree.checked;
        const isPhysical = condition !== "Digital";
        if (isPhysical && !conditionPhotos.length) {
            message.textContent = "Add at least one clear photo so buyers can check the item's condition.";
            return;
        }
        if (conditionPhotos.length > 5 || conditionPhotos.some((photo) => !photo.type.startsWith("image/") || photo.size > 5 * 1024 * 1024)) {
            message.textContent = "Choose up to 5 image files, each no larger than 5 MB.";
            return;
        }
        if (paidDigital && (!file || !file.name.toLowerCase().endsWith(".pdf"))) {
            message.textContent = "Paid digital resources must be uploaded as a PDF so buyers can preview them safely.";
            return;
        }


        let listingSaved = false;
        try {

            message.textContent =
                "Publishing listing...";

            submitListingBtn.disabled = true;


            let fileURL = "";
            let storagePath = "";
            let fileName = "";
            const conditionPhotoUrls = [];
            const conditionPhotoRefs = [];
            const materialRef = doc(collection(db, "materials"));


            /* FILE UPLOAD */

            if (file && !isPhysical) {

                const safeFileName =
                    file.name.replace(
                        /[^a-zA-Z0-9._-]/g,
                        "_"
                    );


                const fileRef =
                    ref(
                        storage,
                        paidDigital
                            ? `private-materials/${currentUser.uid}/${materialRef.id}/original.pdf`
                            : "materials/" + currentUser.uid + "/" + Date.now() + "_" + safeFileName
                    );


                await uploadBytes(
                    fileRef,
                    file,
                    {
                        contentType:
                            file.type ||
                            "application/octet-stream"
                    }
                );


                if (!paidDigital) fileURL = await getDownloadURL(fileRef);

                storagePath =
                    fileRef.fullPath;

                fileName =
                    file.name;

            }

            if (isPhysical) {
                for (const [index, photo] of conditionPhotos.entries()) {
                    const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                    const photoRef = ref(storage, `materials/${currentUser.uid}/${materialRef.id}/condition-preview/${index}_${safeName}`);
                    await uploadBytes(photoRef, photo, { contentType: photo.type });
                    conditionPhotoRefs.push(photoRef);
                    conditionPhotoUrls.push(await getDownloadURL(photoRef));
                }
            }

            /* SAVE LISTING TO FIRESTORE */

            await setDoc(
                materialRef,
                {
                    title: title,

                    category: category,

                    subject: subject,

                    description: description,

                    price: isFree.checked
                        ? 0
                        : Number(price.value),

                    isFree: isFree.checked,

                    condition: condition,

                    contactNumber: contactNumber,

                    fileName: fileName,

                    storagePath: storagePath,

                    ...(paidDigital || isPhysical ? {} : { fileURL }),
                    ...(isPhysical ? { conditionPhotos: conditionPhotoUrls } : {}),

                    ...(paidDigital ? {
                        accessMode: "owner-approval",
                        previewStatus: "processing",
                        previewStoragePath: ""
                    } : {}),

                    uploadedBy: currentUser.uid,

                    uploaderName:
                        currentUser.displayName ||
                        "Student",

                    status: "pending",

                    reviewedAt: null,

                    reviewedBy: "",

                    createdAt:
                        serverTimestamp()
                }
            );
            listingSaved = true;

            if (paidDigital) {
                message.textContent = "Listing saved. Preparing its watermarked preview…";
                const preparePreview = httpsCallable(getFunctions(), "preparePaidDigitalPreview");
                await preparePreview({ materialId: materialRef.id });
            }


            message.textContent =
                "Listing submitted for admin review.";


            setTimeout(() => {

                window.location.href =
                    "home.html";

            }, 1200);


        } catch (error) {

            console.log("Publish error:", error);
            if (!listingSaved) {
                for (const photoRef of conditionPhotoRefs) {
                    try { await deleteObject(photoRef); } catch (cleanupError) { console.warn("Could not remove an incomplete condition photo:", cleanupError); }
                }
            }

            message.textContent = listingSaved
                ? "Your listing was saved, but its preview could not be prepared. Open My Materials and choose Prepare preview to retry."
                : "Publish failed: " + error.message;

            submitListingBtn.disabled = false;

        }

    });

}


/* BACK BUTTON */

if (backBtn) {

    backBtn.addEventListener("click", () => {

        window.location.href =
            "home.html";

    });

}
