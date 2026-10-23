const { onInit } = require("firebase-functions/v2/core");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");

let adminAuth;
let FieldValue;
let db;
let bucket;
onInit(() => {
  const { initializeApp } = require("firebase-admin/app");
  const { getAuth } = require("firebase-admin/auth");
  const { getFirestore, FieldValue: firestoreFieldValue } = require("firebase-admin/firestore");
  const { getStorage } = require("firebase-admin/storage");
  const app = initializeApp({ storageBucket: "book-sahayak.firebasestorage.app" });
  adminAuth = getAuth(app);
  FieldValue = firestoreFieldValue;
  db = getFirestore(app);
  bucket = getStorage(app).bucket();
});
const ADMIN_UID = "vPbcTv2GTMcvdrpVBrNiUDtjGuC3";

function ownerOriginalPath(uid, materialId, path) {
  return typeof path === "string" &&
    path.startsWith(`private-materials/${uid}/${materialId}/original.`);
}

function isPaidDigital(material) {
  return material?.condition === "Digital" && (
    material.isFree === false ||
    (material.isFree !== true && Number(material.price) > 0)
  );
}

async function makePreviewPdf(sourceBytes) {
  const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
  const source = await PDFDocument.load(sourceBytes, { ignoreEncryption: false });
  const pageCount = Math.min(source.getPageCount(), 3);
  if (pageCount < 1) throw new Error("The PDF has no pages.");
  const preview = await PDFDocument.create();
  const pages = await preview.copyPages(source, Array.from({ length: pageCount }, (_, i) => i));
  const font = await preview.embedFont(StandardFonts.HelveticaBold);
  pages.forEach((page) => {
    preview.addPage(page);
    const { width, height } = page.getSize();
    page.drawText("BOOK SAHAYAK • PREVIEW", {
      x: 18, y: Math.max(18, height - 28), size: Math.min(14, Math.max(9, width / 45)),
      font, color: rgb(0.08, 0.35, 0.27), opacity: 0.55
    });
  });
  return Buffer.from(await preview.save());
}

exports.preparePaidDigitalPreview = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const { materialId } = request.data || {};
  if (typeof materialId !== "string" || !materialId) throw new HttpsError("invalid-argument", "Missing listing ID.");
  const ref = db.collection("materials").doc(materialId);
  const snap = await ref.get();
  if (!snap.exists || snap.data().uploadedBy !== request.auth.uid) throw new HttpsError("permission-denied", "Only the listing owner can prepare its preview.");
  const material = snap.data();
  if (!isPaidDigital(material)) throw new HttpsError("failed-precondition", "Preview processing is only for paid digital resources.");
  if (!ownerOriginalPath(request.auth.uid, materialId, material.storagePath) || !material.storagePath.endsWith(".pdf")) {
    throw new HttpsError("failed-precondition", "Paid digital listings must use a privately stored PDF.");
  }
  try {
    const [original] = await bucket.file(material.storagePath).download();
    const previewBytes = await makePreviewPdf(original);
    const previewPath = `digital-previews/${materialId}/preview.pdf`;
    await bucket.file(previewPath).save(previewBytes, { resumable: false, metadata: { contentType: "application/pdf", cacheControl: "private, max-age=300" } });
    await ref.update({ previewStoragePath: previewPath, previewStatus: "ready", accessMode: "owner-approval" });
    return { previewStatus: "ready" };
  } catch (error) {
    await ref.update({ previewStatus: "failed" });
    console.error("Preview generation failed", materialId, error);
    throw new HttpsError("failed-precondition", "Could not create a preview. Check that the uploaded PDF is valid and not password protected.");
  }
});

exports.secureLegacyPaidDigitalResource = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const { materialId } = request.data || {};
  if (typeof materialId !== "string" || !materialId) throw new HttpsError("invalid-argument", "Missing listing ID.");
  const materialRef = db.collection("materials").doc(materialId);
  const snap = await materialRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Listing not found.");
  const material = snap.data();
  const isAdmin = request.auth.uid === ADMIN_UID;
  if (material.uploadedBy !== request.auth.uid && !isAdmin) {
    throw new HttpsError("permission-denied", "Only the listing owner or administrator can secure this file.");
  }
  if (!isPaidDigital(material) || !material.storagePath || material.storagePath.startsWith("private-materials/")) {
    throw new HttpsError("failed-precondition", "This listing does not need legacy-file migration.");
  }
  if (!material.uploadedBy || !material.storagePath.startsWith(`materials/${material.uploadedBy}/`)) {
    throw new HttpsError("failed-precondition", "This listing does not point to a recognized public materials file.");
  }
  const oldFile = bucket.file(material.storagePath);
  const extension = (material.fileName || material.storagePath).split(".").pop().toLowerCase();
  if (!["pdf", "doc", "docx", "ppt", "pptx"].includes(extension)) throw new HttpsError("failed-precondition", "This file type cannot be secured automatically.");
  const privatePath = `private-materials/${material.uploadedBy}/${materialId}/original.${extension}`;
  const [oldExists] = await oldFile.exists();
  const [privateExists] = await bucket.file(privatePath).exists();
  if (oldExists) {
    await oldFile.copy(bucket.file(privatePath));
  } else if (!privateExists) {
    throw new HttpsError("not-found", "Neither the original nor its protected copy could be found.");
  }
  let previewPath = "";
  let previewStatus = "unavailable-format";
  if (extension === "pdf") {
    try {
      const [bytes] = await bucket.file(privatePath).download();
      const previewBytes = await makePreviewPdf(bytes);
      previewPath = `digital-previews/${materialId}/preview.pdf`;
      await bucket.file(previewPath).save(previewBytes, { resumable: false, metadata: { contentType: "application/pdf", cacheControl: "private, max-age=300" } });
      previewStatus = "ready";
    } catch (error) {
      // Keep the private copy when the old public object was already deleted by
      // an earlier interrupted migration; it may be the only remaining original.
      if (oldExists) await bucket.file(privatePath).delete({ ignoreNotFound: true });
      throw new HttpsError("failed-precondition", "Could not preview this PDF. It may be invalid or password protected.");
    }
  }
  // Revoke the old public object before exposing the migrated listing metadata.
  await oldFile.delete({ ignoreNotFound: true });
  const updated = {
    storagePath: privatePath,
    accessMode: "owner-approval",
    previewStoragePath: previewPath,
    previewStatus,
    ...(material.isFree === undefined && Number(material.price) > 0 ? { isFree: false } : {})
  };
  if (material.fileURL) updated.fileURL = FieldValue.delete();
  await materialRef.update(updated);
  return { previewStatus };
});

exports.downloadApprovedDigitalResource = onRequest({ cors: true, timeoutSeconds: 120, memory: "1GiB" }, async (req, res) => {
  if (req.method !== "GET") return res.status(405).send("Method not allowed.");
  try {
    const authorization = req.get("authorization") || "";
    const match = authorization.match(/^Bearer (.+)$/i);
    if (!match) return res.status(401).send("Sign in to download this resource.");
    const decoded = await adminAuth.verifyIdToken(match[1]);
    const materialId = String(req.query.materialId || "");
    const snap = await db.collection("materials").doc(materialId).get();
    if (!snap.exists) return res.status(404).send("Listing not found.");
    const material = snap.data();
    if (!isPaidDigital(material)) return res.status(403).send("This is not a paid digital resource.");
    if (material.accessMode !== "owner-approval" || !ownerOriginalPath(material.uploadedBy, materialId, material.storagePath)) return res.status(403).send("The original file is not protected correctly yet.");
    const isAdmin = decoded.uid === ADMIN_UID;
    let allowed = decoded.uid === material.uploadedBy || isAdmin;
    if (!allowed && material.status !== "approved") return res.status(403).send("This listing is not approved yet.");
    if (!allowed) {
      const requestId = `${materialId}_${decoded.uid}`;
      const requestSnap = await db.collection("downloadRequests").doc(requestId).get();
      allowed = requestSnap.exists && requestSnap.data().status === "approved" && requestSnap.data().buyerUid === decoded.uid && requestSnap.data().materialId === materialId;
    }
    if (!allowed) return res.status(403).send("The seller has not approved your download request.");
    const name = String(material.fileName || "study-resource.pdf").replace(/[\r\n"\\]/g, "_");
    res.set("Content-Type", "application/octet-stream");
    res.set("Content-Disposition", `attachment; filename="${name}"`);
    res.set("Cache-Control", "private, no-store");
    res.set("X-Content-Type-Options", "nosniff");
    const stream = bucket.file(material.storagePath).createReadStream();
    stream.on("error", (error) => { console.error("Download stream failed", error); if (!res.headersSent) res.status(404); res.end("File unavailable."); });
    stream.pipe(res);
  } catch (error) {
    console.error("Protected download failed", error);
    if (!res.headersSent) res.status(error.code === "auth/id-token-expired" ? 401 : 500).send("Could not download this resource.");
  }
});


exports.getWatermarkedDigitalPreview = onRequest({ cors: true, timeoutSeconds: 60, memory: "512MiB" }, async (req, res) => {
  if (req.method !== "GET") return res.status(405).send("Method not allowed.");
  try {
    const authorization = req.get("authorization") || "";
    const match = authorization.match(/^Bearer (.+)$/i);
    if (!match) return res.status(401).send("Sign in to view this preview.");
    const decoded = await adminAuth.verifyIdToken(match[1]);
    const materialId = String(req.query.materialId || "");
    const snap = await db.collection("materials").doc(materialId).get();
    if (!snap.exists) return res.status(404).send("Listing not found.");
    const material = snap.data();
    if (!isPaidDigital(material)) return res.status(403).send("This is not a paid digital resource.");
    const isOwner = decoded.uid === material.uploadedBy;
    const isAdmin = decoded.uid === ADMIN_UID;
    if (!isOwner && !isAdmin && material.status !== "approved") {
      return res.status(403).send("This listing is not available yet.");
    }
    if (
      material.previewStatus !== "ready" ||
      material.previewStoragePath !== "digital-previews/" + materialId + "/preview.pdf"
    ) return res.status(404).send("The preview is not ready yet.");

    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", "inline; filename=book-sahayak-preview.pdf");
    res.set("Cache-Control", "private, no-store");
    res.set("X-Content-Type-Options", "nosniff");
    const stream = bucket.file(material.previewStoragePath).createReadStream();
    stream.on("error", (error) => {
      console.error("Preview stream failed", materialId, error);
      if (!res.headersSent) res.status(404);
      res.end("Preview file unavailable.");
    });
    stream.pipe(res);
  } catch (error) {
    console.error("Protected preview failed", error);
    if (!res.headersSent) res.status(error.code === "auth/id-token-expired" ? 401 : 500).send("Could not load this preview.");
  }
});


exports.adminDeleteListing = onCall({ timeoutSeconds: 120, memory: "512MiB" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to continue.");
  if (request.auth.uid !== ADMIN_UID) throw new HttpsError("permission-denied", "Only the administrator can delete listings.");
  const materialId = request.data && request.data.materialId;
  if (typeof materialId !== "string" || !/^[A-Za-z0-9_-]{1,150}$/.test(materialId)) {
    throw new HttpsError("invalid-argument", "Invalid listing ID.");
  }

  const materialRef = db.collection("materials").doc(materialId);
  const snap = await materialRef.get();
  if (!snap.exists) return { deleted: true, alreadyMissing: true };
  const material = snap.data();
  const paths = new Set();
  const storagePath = material.storagePath;
  if (typeof storagePath === "string" && (
    storagePath.startsWith("materials/" + material.uploadedBy + "/") ||
    storagePath.startsWith("private-materials/" + material.uploadedBy + "/" + materialId + "/")
  )) paths.add(storagePath);
  const previewPath = "digital-previews/" + materialId + "/preview.pdf";
  if (material.previewStoragePath === previewPath) paths.add(previewPath);
  if (Array.isArray(material.conditionPhotos)) {
    material.conditionPhotos.forEach((url) => addFileUrlPath(url, paths));
  }

  try {
    for (const objectPath of paths) {
      await bucket.file(objectPath).delete({ ignoreNotFound: true });
    }
    while (true) {
      const requests = await db.collection("downloadRequests")
        .where("materialId", "==", materialId).limit(400).get();
      if (requests.empty) break;
      const batch = db.batch();
      requests.docs.forEach((requestDoc) => batch.delete(requestDoc.ref));
      await batch.commit();
    }
    await materialRef.delete();
    return { deleted: true, deletedFiles: paths.size };
  } catch (error) {
    console.error("Admin listing deletion failed", materialId, error);
    throw new HttpsError("internal", "Could not fully delete this listing. You can retry from Admin.");
  }
});


function addFileUrlPath(url, paths) {
  if (typeof url !== "string") return;
  try {
    const parsed = new URL(url);
    const marker = "/o/";
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) return;
    const objectPath = decodeURIComponent(parsed.pathname.slice(index + marker.length));
    if (objectPath.startsWith("materials/")) paths.add(objectPath);
  } catch (_) {}
}

async function getReferencedPublicMaterialPaths() {
  const materials = await db.collection("materials").get();
  const referenced = new Set();
  materials.docs.forEach((doc) => {
    const material = doc.data();
    if (typeof material.storagePath === "string" && material.storagePath.startsWith("materials/")) {
      referenced.add(material.storagePath);
    }
    addFileUrlPath(material.fileURL, referenced);
    if (Array.isArray(material.conditionPhotos)) {
      material.conditionPhotos.forEach((url) => addFileUrlPath(url, referenced));
    }
  });
  return referenced;
}

exports.adminListOrphanedMaterialFiles = onCall({ timeoutSeconds: 120, memory: "512MiB" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to continue.");
  if (request.auth.uid !== ADMIN_UID) throw new HttpsError("permission-denied", "Only the administrator can scan Storage files.");
  try {
    const referenced = await getReferencedPublicMaterialPaths();
    const [files] = await bucket.getFiles({ prefix: "materials/", maxResults: 1000 });
    const orphaned = files
      .filter((file) => !file.name.endsWith("/") && !referenced.has(file.name))
      .slice(0, 250)
      .map((file) => ({
        path: file.name,
        size: Number(file.metadata && file.metadata.size || 0),
        updated: file.metadata && file.metadata.updated || null
      }));
    return { files: orphaned, truncated: orphaned.length === 250 };
  } catch (error) {
    console.error("Orphaned Storage scan failed", error);
    throw new HttpsError("internal", "Could not scan Storage for unlinked files.");
  }
});

exports.adminDeleteOrphanedMaterialFile = onCall({ timeoutSeconds: 120, memory: "512MiB" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to continue.");
  if (request.auth.uid !== ADMIN_UID) throw new HttpsError("permission-denied", "Only the administrator can delete Storage files.");
  const objectPath = request.data && request.data.path;
  if (typeof objectPath !== "string" || !objectPath.startsWith("materials/") || objectPath.includes("..")) {
    throw new HttpsError("invalid-argument", "Invalid Storage file path.");
  }
  try {
    const referenced = await getReferencedPublicMaterialPaths();
    if (referenced.has(objectPath)) {
      throw new HttpsError("failed-precondition", "This file is linked to a current listing. Delete that listing instead.");
    }
    await bucket.file(objectPath).delete({ ignoreNotFound: true });
    return { deleted: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("Orphaned Storage file deletion failed", objectPath, error);
    throw new HttpsError("internal", "Could not delete this unlinked file.");
  }
});
