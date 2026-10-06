import { db, auth } from "./firebase.js";

import {
    collection,
    getDocs,
    doc,
    updateDoc,
    arrayUnion,
    query,
    or,
    where
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";


/* =========================================================
   ELEMENTS
========================================================= */

const chatsList =
    document.getElementById("chatsList");

const chatsLoading =
    document.getElementById("chatsLoading");

const chatsEmpty =
    document.getElementById("chatsEmpty");

const chatsError =
    document.getElementById("chatsError");

const chatsErrorMessage =
    document.getElementById("chatsErrorMessage");

const retryChatsBtn =
    document.getElementById("retryChatsBtn");

const browseMaterialsBtn =
    document.getElementById("browseMaterialsBtn");

const backBtn =
    document.getElementById("backBtn");

const chatSearch =
    document.getElementById("chatSearch");

const chatCount =
    document.getElementById("chatCount");

const noSearchResults =
    document.getElementById("noSearchResults");


/* =========================================================
   CURRENT USER
========================================================= */

let currentUser = null;
let allChats = [];


/* =========================================================
   FORMAT TIME
========================================================= */

function formatChatTime(timestamp) {

    if (!timestamp) {
        return "";
    }

    let date;

    try {

        if (
            timestamp &&
            typeof timestamp.toDate === "function"
        ) {
            date = timestamp.toDate();
        }

        else if (
            timestamp &&
            typeof timestamp.toMillis === "function"
        ) {
            date = new Date(
                timestamp.toMillis()
            );
        }

        else {
            date = new Date(timestamp);
        }

    }

    catch (error) {
        return "";
    }


    if (isNaN(date.getTime())) {
        return "";
    }


    const now = new Date();

    if (
        now.toDateString() ===
        date.toDateString()
    ) {

        return date.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }


    const yesterday =
        new Date(now);

    yesterday.setDate(
        yesterday.getDate() - 1
    );


    if (
        yesterday.toDateString() ===
        date.toDateString()
    ) {

        return "Yesterday";
    }


    return date.toLocaleDateString(
        [],
        {
            day: "2-digit",
            month: "short"
        }
    );
}


/* =========================================================
   TIMESTAMP TO MILLISECONDS
========================================================= */

function getTimestampMillis(timestamp) {

    if (!timestamp) {
        return 0;
    }

    try {

        if (
            typeof timestamp.toMillis ===
            "function"
        ) {
            return timestamp.toMillis();
        }


        if (
            typeof timestamp.toDate ===
            "function"
        ) {
            return timestamp
                .toDate()
                .getTime();
        }


        const date =
            new Date(timestamp);

        return isNaN(date.getTime())
            ? 0
            : date.getTime();

    }

    catch (error) {
        return 0;
    }
}


/* =========================================================
   GET OTHER USER
========================================================= */

function getOtherUser(chat) {

    if (!currentUser || !chat) {
        return null;
    }


    /* CURRENT USER IS SELLER */

    if (
        chat.sellerId ===
        currentUser.uid
    ) {

        if (chat.buyerId) {

            return {
                id: chat.buyerId,

                name:
                    chat.buyerName ||
                    "Buyer"
            };
        }
    }


    /* CURRENT USER IS BUYER */

    if (
        chat.buyerId ===
        currentUser.uid
    ) {

        if (chat.sellerId) {

            return {
                id: chat.sellerId,

                name:
                    chat.sellerName ||
                    "Seller"
            };
        }
    }


    /* FALLBACK FOR OLDER CHAT DOCUMENTS */

    if (
        Array.isArray(
            chat.participants
        )
    ) {

        const otherId =
            chat.participants.find(
                uid =>
                    uid !==
                    currentUser.uid
            );


        if (otherId) {

            return {
                id: otherId,

                name:
                    chat.sellerId === otherId
                        ? (
                            chat.sellerName ||
                            "Seller"
                        )
                        : (
                            chat.buyerName ||
                            "Buyer"
                        )
            };
        }
    }


    return null;
}


/* =========================================================
   OPEN CHAT
========================================================= */

function openChat(chat) {

    const otherUser =
        getOtherUser(chat);


    if (!otherUser) {

        alert(
            "Could not identify this conversation."
        );

        return;
    }


    let url =
        "chat.html?user=" +
        encodeURIComponent(
            otherUser.id
        );


    if (chat.materialId) {

        url +=
            "&material=" +
            encodeURIComponent(
                chat.materialId
            );
    }


    window.location.href = url;
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }


    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(value);


    return div.innerHTML;
}


/* =========================================================
   CREATE CHAT CARD
========================================================= */

function createChatCard(
    chat,
    chatId
) {

    const otherUser =
        getOtherUser(chat);


    if (!otherUser) {
        console.warn(
            "Skipping chat because other user could not be identified:",
            chatId,
            chat
        );

        return null;
    }


    const card =
        document.createElement("div");


    card.className =
        "chat-list-card";


    const lastMessage =
        chat.lastMessage ||
        "Start a conversation";


    const materialTitle =
        chat.materialTitle ||
        "Book Sahayak Resource";


    const chatTime =
        formatChatTime(
            chat.updatedAt
        );


    const sentByMe =
        chat.lastMessageSenderId ===
        currentUser.uid;


    const unreadCount =
        Number(
            chat.unreadCounts?.[
                currentUser.uid
            ] || 0
        );


    let messagePreview =
        lastMessage;


    if (sentByMe) {

        messagePreview =
            "You: " +
            lastMessage;
    }


    card.innerHTML = `

        <div class="chat-avatar">
            👤
            <span class="chat-online-dot"></span>
        </div>


        <div class="chat-card-content">

            <div class="chat-card-top">

                <h3>
                    ${escapeHTML(
                        otherUser.name
                    )}
                </h3>

                <span class="chat-time">
                    ${escapeHTML(
                        chatTime
                    )}
                </span>

                ${
                    unreadCount > 0
                        ? `
                            <span
                                class="chat-unread-badge"
                                aria-label="${unreadCount} unread messages"
                            >
                                ${unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                        `
                        : ""
                }

            </div>


            <p class="chat-material-title">

                ${escapeHTML(
                    materialTitle
                )}

            </p>


            <p class="chat-last-message">

                ${escapeHTML(
                    messagePreview
                )}

            </p>

        </div>


        <button
            class="chat-delete-btn"
            type="button"
            title="Delete conversation"
            aria-label="Delete conversation"
        >
            🗑
        </button>


        <div class="chat-arrow">
            ›
        </div>

    `;


    /* =====================================================
       DELETE BUTTON
    ===================================================== */

    const deleteBtn =
        card.querySelector(
            ".chat-delete-btn"
        );


    if (deleteBtn) {

        deleteBtn.addEventListener(
            "click",
            async function (event) {

                event.stopPropagation();


                await deleteChatForMe(
                    chat,
                    chatId,
                    card
                );

            }
        );
    }


    /* =====================================================
       OPEN CHAT
    ===================================================== */

    card.addEventListener(
        "click",
        function () {

            openChat(chat);

        }
    );


    return card;
}


/* =========================================================
   DISPLAY CHAT COUNT
========================================================= */

function updateChatCount() {

    const visibleChats =
        chatsList.children.length;


    if (chatCount) {

        chatCount.textContent =
            visibleChats === 1
                ? "1 chat"
                : `${visibleChats} chats`;
    }
}


/* =========================================================
   DISPLAY CHATS
========================================================= */

function displayChats(
    chats
) {

    chatsList.innerHTML = "";


    if (noSearchResults) {
        noSearchResults.style.display =
            "none";
    }


    let displayed = 0;


    chats.forEach(
        function (chat) {

            const card =
                createChatCard(
                    chat.data,
                    chat.id
                );


            if (card) {

                chatsList.appendChild(
                    card
                );

                displayed++;
            }

        }
    );


    updateChatCount();


    /* =====================================================
       NO RESULTS
    ===================================================== */

    if (displayed === 0) {
        const hasAnyChats = allChats.length > 0;
        const isSearching = Boolean(chatSearch?.value.trim());

        if (noSearchResults) {
            noSearchResults.style.display =
                hasAnyChats && isSearching ? "block" : "none";
        }

        if (chatsEmpty) {
            chatsEmpty.style.display =
                hasAnyChats && isSearching ? "none" : "flex";
        }
    } else {
        if (noSearchResults) noSearchResults.style.display = "none";
        if (chatsEmpty) chatsEmpty.style.display = "none";
    }
}


/* =========================================================
   LOAD CHATS
========================================================= */

async function loadChats() {

    if (!currentUser) {
        return;
    }


    if (chatsLoading) {

        chatsLoading.style.display =
            "flex";
    }


    if (chatsList) {
        chatsList.innerHTML = "";
    }


    if (chatsEmpty) {

        chatsEmpty.style.display =
            "none";
    }


    if (chatsError) {

        chatsError.style.display =
            "none";
    }


    try {

        console.log(
            "================================"
        );

        console.log(
            "LOADING ALL CHATS"
        );

        console.log(
            "CURRENT USER:",
            currentUser.uid
        );


        /* =================================================
           GET CHAT HEADERS, THEN KEEP ONLY THIS USER'S CHATS
        ================================================= */

        const snapshot =
            await getDocs(
                query(
                    collection(db, "chats"),
                    or(
                        where("participants", "array-contains", currentUser.uid),
                        where("buyerId", "==", currentUser.uid),
                        where("sellerId", "==", currentUser.uid)
                    )
                )
            );


        console.log(
            "TOTAL CHAT DOCUMENTS:",
            snapshot.size
        );


        allChats = [];


        snapshot.forEach(
            function (docSnapshot) {

                const data =
                    docSnapshot.data();


                console.log(
                    "CHAT:",
                    docSnapshot.id,
                    data
                );


                /* =========================================
                   CHECK IF CURRENT USER BELONGS TO CHAT
                ========================================= */

                const isParticipant =

                    data.buyerId ===
                        currentUser.uid

                    ||

                    data.sellerId ===
                        currentUser.uid

                    ||

                    (
                        Array.isArray(
                            data.participants
                        )
                        &&
                        data.participants.includes(
                            currentUser.uid
                        )
                    );


                if (!isParticipant) {

                    return;
                }


                /* =================================================
                   HIDE CHATS DELETED FOR CURRENT USER
                ================================================= */

                const hiddenFor =
                    Array.isArray(
                        data.hiddenFor
                    )
                        ? data.hiddenFor
                        : [];


                if (
                    hiddenFor.includes(
                        currentUser.uid
                    )
                ) {

                    console.log(
                        "SKIPPING HIDDEN CHAT:",
                        docSnapshot.id
                    );

                    return;
                }


                allChats.push({

                    id:
                        docSnapshot.id,

                    data:
                        data

                });

            }
        );


        console.log(
            "CHATS BELONGING TO CURRENT USER:",
            allChats.length
        );


        /* =================================================
           NEWEST FIRST
        ================================================= */

        allChats.sort(
            function (a, b) {

                const timeA =
                    getTimestampMillis(
                        a.data.updatedAt
                    );


                const timeB =
                    getTimestampMillis(
                        b.data.updatedAt
                    );


                return timeB - timeA;

            }
        );


        if (chatsLoading) {

            chatsLoading.style.display =
                "none";
        }


        displayChats(
            allChats
        );

    }


    catch (error) {

        console.error(
            "ERROR LOADING CHATS:",
            error
        );


        if (chatsLoading) {

            chatsLoading.style.display =
                "none";
        }


        if (chatsError) {

            chatsError.style.display =
                "block";
        }


        if (chatsErrorMessage) {

            chatsErrorMessage.textContent =
                error.message ||
                "Could not load conversations.";
        }

    }
}


/* =========================================================
   SEARCH
========================================================= */

if (chatSearch) {

    chatSearch.addEventListener(
        "input",
        function () {

            const search =
                chatSearch.value
                    .trim()
                    .toLowerCase();


            if (!search) {

                displayChats(
                    allChats
                );

                return;
            }


            const filtered =
                allChats.filter(
                    function (chat) {

                        const data =
                            chat.data;


                        const otherUser =
                            getOtherUser(
                                data
                            );


                        const name =
                            otherUser?.name ||
                            "";


                        const material =
                            data.materialTitle ||
                            "";


                        const lastMessage =
                            data.lastMessage ||
                            "";


                        return (

                            name
                                .toLowerCase()
                                .includes(
                                    search
                                )

                            ||

                            material
                                .toLowerCase()
                                .includes(
                                    search
                                )

                            ||

                            lastMessage
                                .toLowerCase()
                                .includes(
                                    search
                                )

                        );

                    }
                );


            displayChats(
                filtered
            );

        }
    );
}


/* =========================================================
   DELETE CHAT FOR ME
========================================================= */

async function deleteChatForMe(
    chat,
    chatId,
    card
) {

    if (!currentUser) {
        return;
    }


    const otherUser =
        getOtherUser(chat);


    const name =
        otherUser?.name ||
        "this user";


    const confirmed =
        confirm(
            `Delete this conversation with ${name} from your chats?`
        );


    if (!confirmed) {
        return;
    }


    try {

        const chatRef =
            doc(
                db,
                "chats",
                chatId
            );


        await updateDoc(
            chatRef,
            {
                hiddenFor:
                    arrayUnion(
                        currentUser.uid
                    )
            }
        );


        allChats =
            allChats.filter(
                function (item) {
                    return item.id !== chatId;
                }
            );


        card.style.opacity =
            "0";


        card.style.transform =
            "translateX(30px)";


        setTimeout(
            function () {

                card.remove();

                updateChatCount();


                if (chatsList.children.length === 0) {
                    displayChats([]);
                }

            },
            200
        );

    }


    catch (error) {

        console.error(
            "Error deleting chat:",
            error
        );


        alert(
            "Could not delete this conversation. Please try again."
        );
    }
}


/* =========================================================
   RETRY
========================================================= */

if (retryChatsBtn) {

    retryChatsBtn.addEventListener(
        "click",
        function () {

            loadChats();

        }
    );
}


/* =========================================================
   BROWSE MATERIALS
========================================================= */

if (browseMaterialsBtn) {

    browseMaterialsBtn.addEventListener(
        "click",
        function () {

            window.location.href =
                "home.html";

        }
    );
}


/* =========================================================
   BACK BUTTON
========================================================= */

if (backBtn) {

    backBtn.addEventListener(
        "click",
        function () {

            window.history.back();

        }
    );
}


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(
    auth,
    async function (user) {

        if (!user) {

            window.location.href =
                "index.html";

            return;
        }


        currentUser =
            user;


        console.log(
            "LOGGED IN USER:",
            currentUser.uid
        );


        await loadChats();

    }
);
// =========================================
// MESSAGE ATTACHMENT / MORE BUTTON
// =========================================

const attachmentBtn = document.getElementById("attachmentBtn");

if (attachmentBtn) {
    attachmentBtn.innerHTML = "+";

    attachmentBtn.onclick = function () {
        alert("BOTTOM + BUTTON IS WORKING");
    };
}
