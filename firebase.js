import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  doc,
  collection,
  query,
  or,
  where,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtabM11H19VclSMxwage4ZDXxKTvgsvu4",
  authDomain: "book-sahayak.firebaseapp.com",
  projectId: "book-sahayak",
  storageBucket: "book-sahayak.firebasestorage.app",
  messagingSenderId: "758198853938",
  appId: "1:758198853938:web:39da7e56484944c9b1372b"
};

const app = initializeApp(firebaseConfig);

export const ADMIN_UID = "vPbcTv2GTMcvdrpVBrNiUDtjGuC3";
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

const PRESENCE_HEARTBEAT_MS = 30000;
const PRESENCE_TIMEOUT_MS = 60000;

let activeUser = null;
let heartbeatId = null;
let stopWatchingPresence = null;
let stopWatchingUnreadMessages = null;
let stopWatchingDownloadRequests = null;
let stopWatchingBuyerDownloadRequests = null;
let presenceRefreshId = null;

async function updatePresence(isOnline) {
  if (!activeUser) return;

  try {
    await setDoc(
      doc(db, "presence", activeUser.uid),
      {
        isOnline,
        lastSeen: serverTimestamp()
      },
      { merge: true }
    );
  } catch (error) {
    console.warn("Could not update presence:", error);
  }
}

function showChatPresence(userId) {
  if (!userId || !window.location.pathname.endsWith("chat.html")) return;

  const statusElement = document.getElementById("chatStatus");
  if (!statusElement) return;

  stopWatchingPresence?.();
  clearInterval(presenceRefreshId);

  let latestPresence = null;

  const renderPresence = () => {
    const lastSeen = latestPresence?.lastSeen?.toDate?.();
    const isRecentlyActive =
      lastSeen && Date.now() - lastSeen.getTime() < PRESENCE_TIMEOUT_MS;
    const isOnline = latestPresence?.isOnline === true && isRecentlyActive;

    if (isOnline) {
      statusElement.textContent = "Online";
    } else if (lastSeen) {
      const elapsedSeconds = Math.max(
        0,
        Math.floor((Date.now() - lastSeen.getTime()) / 1000)
      );

      if (elapsedSeconds < 60) {
        statusElement.textContent = "Last seen just now";
      } else if (elapsedSeconds < 3600) {
        statusElement.textContent = `Last seen ${Math.floor(elapsedSeconds / 60)} min ago`;
      } else if (elapsedSeconds < 86400) {
        statusElement.textContent = `Last seen ${Math.floor(elapsedSeconds / 3600)} hr ago`;
      } else {
        statusElement.textContent = `Last seen ${lastSeen.toLocaleDateString([], {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit"
        })}`;
      }
    } else {
      statusElement.textContent = "Offline";
    }

    statusElement.classList.toggle("is-online", isOnline);
    statusElement.classList.toggle("is-offline", !isOnline);
  };

  stopWatchingPresence = onSnapshot(
    doc(db, "presence", userId),
    (snapshot) => {
      latestPresence = snapshot.data();
      renderPresence();
    },
    () => {
      statusElement.textContent = "Offline";
      statusElement.classList.remove("is-online");
      statusElement.classList.add("is-offline");
    }
  );

  presenceRefreshId = setInterval(renderPresence, PRESENCE_HEARTBEAT_MS);
}

function showUnreadMessages(count) {
  document.querySelectorAll(".nav-chat-link").forEach((link) => {
    let badge = link.querySelector(".unread-messages-badge");

    if (!badge) {
      badge = document.createElement("span");
      badge.className = "unread-messages-badge";
      badge.setAttribute("aria-live", "polite");
      link.appendChild(badge);
    }

    badge.textContent = count > 99 ? "99+" : String(count);
    badge.hidden = count === 0;
    link.setAttribute(
      "aria-label",
      count === 0 ? "Messages" : `Messages, ${count} unread`
    );
  });
}

let browserNotificationButton = null;

function showNativeNotification(title, body, destination, tag) {
  if (!document.hidden || !("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const notification = new Notification(title, {
      body,
      icon: "/book-sahayak-icon.png",
      tag
    });
    notification.onclick = () => {
      window.focus();
      window.location.href = destination;
      notification.close();
    };
  } catch (error) {
    console.warn("Could not show browser notification:", error);
  }
}

function mountBrowserNotificationControl() {
  const accountDropdown = document.querySelector(".home-navbar .account-dropdown");
  if (!accountDropdown || browserNotificationButton?.isConnected || !("Notification" in window)) return;
  // Only offer setup while the browser has not made a choice. Once enabled or
  // blocked, there is no persistent status button taking space in page headers.
  if (Notification.permission !== "default") return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "browser-notification-control";
  button.textContent = "🔔 Enable browser alerts";
  button.setAttribute("aria-label", "Enable browser alerts");
  button.title = "Get alerts while the website is open in a background tab.";
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "default") {
        button.remove();
        browserNotificationButton = null;
      } else {
        button.disabled = false;
      }
    } catch (error) {
      button.disabled = false;
      console.warn("Could not request notification permission:", error);
    }
  });
  accountDropdown.append(button);
  browserNotificationButton = button;
}function showMessageToast(chat) {
  const senderName = chat.lastMessageSenderName || "Someone";
  const messageText = chat.lastMessage || "sent you a message";
  const existingToast = document.querySelector(".message-notification-toast");

  existingToast?.remove();

  const toast = document.createElement("button");
  const title = document.createElement("strong");
  const preview = document.createElement("span");

  toast.type = "button";
  toast.className = "message-notification-toast";
  title.textContent = `💬 New message from ${senderName}`;
  preview.textContent = messageText;
  toast.append(title, preview);
  toast.addEventListener("click", () => {
    window.location.href = "chats.html";
  });

  document.body.appendChild(toast);
  showNativeNotification(`New message from ${senderName}`, messageText, "chats.html", `chat-${chat.lastMessageId || "latest"}`);

  window.setTimeout(() => toast.remove(), 6000);
}

function showDownloadRequestToast(request) {
  document.querySelector(".message-notification-toast")?.remove();

  const toast = document.createElement("button");
  const title = document.createElement("strong");
  const preview = document.createElement("span");
  toast.type = "button";
  toast.className = "message-notification-toast download-request-notification-toast";
  title.textContent = "📄 Someone requested your full file";
  preview.textContent = `${request.buyerName || "A student"} wants access to “${request.materialTitle || "your resource"}”.`;
  toast.append(title, preview);
  toast.addEventListener("click", () => {
    window.location.href = "my-materials.html";
  });
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 8000);

  showNativeNotification("New full-file request", preview.textContent, "my-materials.html", `download-request-${request.materialId || "resource"}`);

}

function showDownloadStatusToast(request) {
  const status = request.status;
  const approved = status === "approved";
  const toast = document.createElement("button");
  const title = document.createElement("strong");
  const preview = document.createElement("span");
  toast.type = "button";
  toast.className = `message-notification-toast download-request-notification-toast${approved ? "" : " download-request-status-rejected"}`;
  title.textContent = approved ? "✅ Your full-file request was approved" : "↩️ Your full-file request was declined";
  preview.textContent = approved
    ? `You can now open “${request.materialTitle || "the resource"}” and download the file.`
    : `The owner declined access to “${request.materialTitle || "the resource"}”.`;
  toast.append(title, preview);
  toast.addEventListener("click", () => {
    window.location.href = `material.html?id=${encodeURIComponent(request.materialId || "")}`;
  });
  document.querySelector(".message-notification-toast")?.remove();
  document.body.appendChild(toast);
  const destination = `material.html?id=${encodeURIComponent(request.materialId || "")}`;
  showNativeNotification(title.textContent, preview.textContent, destination, `download-status-${request.materialId || "resource"}`);
  window.setTimeout(() => toast.remove(), 8000);
}

function watchBuyerDownloadRequests(userId) {
  stopWatchingBuyerDownloadRequests?.();
  let receivedInitialSnapshot = false;
  const lastStatuses = new Map();
  stopWatchingBuyerDownloadRequests = onSnapshot(
    query(collection(db, "downloadRequests"), where("buyerUid", "==", userId)),
    (snapshot) => {
      if (!receivedInitialSnapshot) {
        snapshot.forEach((item) => lastStatuses.set(item.id, item.data().status));
        receivedInitialSnapshot = true;
        return;
      }
      snapshot.docChanges().forEach((change) => {
        const request = change.doc.data();
        const previousStatus = lastStatuses.get(change.doc.id);
        if (change.type === "modified" && previousStatus === "pending" && ["approved", "rejected"].includes(request.status)) {
          showDownloadStatusToast(request);
        }
        if (change.type === "removed") lastStatuses.delete(change.doc.id);
        else lastStatuses.set(change.doc.id, request.status);
      });
    },
    (error) => console.warn("Could not watch your full-file requests:", error)
  );
}
function watchDownloadRequests(userId) {
  stopWatchingDownloadRequests?.();
  let receivedInitialSnapshot = false;
  stopWatchingDownloadRequests = onSnapshot(
    query(collection(db, "downloadRequests"), where("sellerUid", "==", userId)),
    (snapshot) => {
      if (receivedInitialSnapshot) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added" && change.doc.data().status === "pending") {
            showDownloadRequestToast(change.doc.data());
          }
        });
      }
      receivedInitialSnapshot = true;
    },
    (error) => console.warn("Could not watch full-file requests:", error)
  );
}
function watchUnreadMessages(userId) {
  stopWatchingUnreadMessages?.();

  let receivedInitialSnapshot = false;
  const lastSeenMessageIds = new Map();

  stopWatchingUnreadMessages = onSnapshot(
    query(
      collection(db, "chats"),
      or(
        where("participants", "array-contains", userId),
        where("buyerId", "==", userId),
        where("sellerId", "==", userId)
      )
    ),
    (snapshot) => {
      let total = 0;

      snapshot.forEach((chatDocument) => {
        const chat = chatDocument.data();
        const isParticipant =
          chat.buyerId === userId ||
          chat.sellerId === userId ||
          chat.participants?.includes?.(userId);

        const isHiddenForUser =
          Array.isArray(chat.hiddenFor) && chat.hiddenFor.includes(userId);
        const clearedAt = chat.clearedAtBy?.[userId]?.toMillis?.() || 0;
        const lastActivityAt = chat.updatedAt?.toMillis?.() || 0;
        const unreadMessagesWereCleared =
          clearedAt > 0 && (!lastActivityAt || clearedAt >= lastActivityAt);

        if (isParticipant && !isHiddenForUser && !unreadMessagesWereCleared) {
          total += Number(chat.unreadCounts?.[userId] || 0);
        }
      });

      showUnreadMessages(total);

      if (receivedInitialSnapshot) {
        snapshot.docChanges().forEach((change) => {
          const chat = change.doc.data();
          const previousMessageId = lastSeenMessageIds.get(change.doc.id);
          const hasNewMessage = Boolean(chat.lastMessageId) &&
            chat.lastMessageId !== previousMessageId;
          const hasNewIncomingMessage =
            (change.type === "added" || change.type === "modified") &&
            hasNewMessage &&
            chat.lastMessageSenderId !== userId &&
            Boolean(chat.lastMessage);

          if (hasNewIncomingMessage) {
            showMessageToast(chat);
          }

          if (change.type === "removed") {
            lastSeenMessageIds.delete(change.doc.id);
          } else if (chat.lastMessageId) {
            lastSeenMessageIds.set(change.doc.id, chat.lastMessageId);
          }
        });
      } else {
        snapshot.forEach((chatDocument) => {
          const chat = chatDocument.data();
          if (chat.lastMessageId) {
            lastSeenMessageIds.set(chatDocument.id, chat.lastMessageId);
          }
        });
      }

      receivedInitialSnapshot = true;
    },
    () => showUnreadMessages(0)
  );
}

onAuthStateChanged(auth, (user) => {
  if (heartbeatId) {
    clearInterval(heartbeatId);
    heartbeatId = null;
  }

  if (!user) {
    const signedOutUser = activeUser;
    activeUser = null;
    clearInterval(presenceRefreshId);
    presenceRefreshId = null;
    stopWatchingPresence?.();
    stopWatchingPresence = null;
    stopWatchingUnreadMessages?.();
    stopWatchingUnreadMessages = null;
    stopWatchingDownloadRequests?.();
    stopWatchingDownloadRequests = null;
    stopWatchingBuyerDownloadRequests?.();
    stopWatchingBuyerDownloadRequests = null;
    showUnreadMessages(0);

    if (signedOutUser) {
      setDoc(
        doc(db, "presence", signedOutUser.uid),
        { isOnline: false, lastSeen: serverTimestamp() },
        { merge: true }
      ).catch(() => {});
    }

    return;
  }

  activeUser = user;
  mountBrowserNotificationControl();

  updatePresence(true);
  heartbeatId = setInterval(() => updatePresence(!document.hidden), PRESENCE_HEARTBEAT_MS);

  const params = new URLSearchParams(window.location.search);
  const otherUserId =
    params.get("user") ||
    params.get("userId") ||
    params.get("otherUserId") ||
    params.get("sellerId") ||
    params.get("recipientId");

  showChatPresence(otherUserId);
  watchUnreadMessages(user.uid);
  watchDownloadRequests(user.uid);
  watchBuyerDownloadRequests(user.uid);
});

document.addEventListener("visibilitychange", () => updatePresence(!document.hidden));
window.addEventListener("pagehide", () => updatePresence(false));
