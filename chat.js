import { db, auth } from "./firebase.js";

import {
    doc,
    getDoc,
    setDoc,
    collection,
    addDoc,
    onSnapshot,
    serverTimestamp,
    increment
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";


/* =========================================================
    URL PARAMETERS
========================================================= */

const params = new URLSearchParams(
    window.location.search
);

const otherUserId = params.get("user");
const materialId = params.get("material");


/* =========================================================
    HTML ELEMENTS
========================================================= */

const sellerNameElement =
    document.getElementById("sellerName");

const materialTitleElement =
    document.getElementById("materialTitle");

const materialPriceElement =
    document.getElementById("materialPrice");

const messagesContainer =
    document.getElementById("messagesContainer");

const messageInput =
    document.getElementById("messageInput");

const sendBtn =
    document.getElementById("sendBtn");

const backBtn =
    document.getElementById("backBtn");

const themeBtn =
    document.getElementById("themeBtn");

const chatSearchBtn =
    document.getElementById("chatSearchBtn");

const chatMoreBtn =
    document.getElementById("chatMoreBtn");

const messageOptionsBtn =
    document.getElementById("messageOptionsBtn");

const chatSearchBar =
    document.getElementById("chatSearchBar");

const chatSearchInput =
    document.getElementById("chatSearchInput");

const closeSearchBtn =
    document.getElementById("closeSearchBtn");

const searchResultCount =
    document.getElementById("searchResultCount");

const chatMenu =
    document.getElementById("chatMenu");

const clearChatBtn =
    document.getElementById("clearChatBtn");

const closeChatMenuBtn =
    document.getElementById("closeChatMenuBtn");

const messageOptionsMenu =
    document.getElementById("messageOptionsMenu");

const emojiOptionBtn =
    document.getElementById("emojiOptionBtn");

const clearDraftBtn =
    document.getElementById("clearDraftBtn");


/* =========================================================
    VARIABLES
========================================================= */

let currentUser = null;

let materialData = null;

let otherPersonName = "User";

let unsubscribeMessages = null;

let clearedMessagesBefore = 0;


/* =========================================================
    CREATE SAME CHAT ID FOR BOTH USERS
========================================================= */

function createChatId(
    user1,
    user2,
    material
) {

    const users = [
        user1,
        user2
    ].sort();

    return (
        users[0] +
        "_" +
        users[1] +
        "_" +
        material
    );
}


/* =========================================================
    CURRENT USER NAME
========================================================= */

function getCurrentUserName() {

    if (!currentUser) {
        return "User";
    }

    return (
        currentUser.displayName ||
        currentUser.email ||
        "User"
    );
}


/* =========================================================
    LOAD MATERIAL
========================================================= */

async function loadMaterial() {

    if (!materialId) {

        if (materialTitleElement) {
            materialTitleElement.textContent =
                "Material not specified.";
        }

        return false;
    }

    try {

        const materialRef = doc(
            db,
            "materials",
            materialId
        );

        const materialDoc =
            await getDoc(materialRef);

        if (!materialDoc.exists()) {

            if (materialTitleElement) {
                materialTitleElement.textContent =
                    "Material not found.";
            }

            return false;
        }

        materialData =
            materialDoc.data();


        /* TITLE */

        if (materialTitleElement) {

            materialTitleElement.textContent =
                materialData.title ||
                "Untitled Material";
        }


        /* PRICE */

        if (materialPriceElement) {

            if (materialData.isFree) {

                materialPriceElement.textContent =
                    "FREE";

            } else if (
                materialData.price !== undefined &&
                materialData.price !== null &&
                materialData.price !== ""
            ) {

                materialPriceElement.textContent =
                    "₹" +
                    materialData.price;

            } else {

                materialPriceElement.textContent =
                    "Price not specified";
            }
        }

        return true;

    }
    catch (error) {

        console.error(
            "Material loading error:",
            error
        );

        if (materialTitleElement) {
            materialTitleElement.textContent =
                "Could not load material.";
        }

        return false;
    }
}


/* =========================================================
    SETUP CHAT
========================================================= */

async function setupChat() {

    if (
        !currentUser ||
        !otherUserId ||
        !materialId ||
        !materialData
    ) {
        return null;
    }

    const chatId =
        createChatId(
            currentUser.uid,
            otherUserId,
            materialId
        );

    const chatRef =
        doc(
            db,
            "chats",
            chatId
        );

    const existingChat =
        await getDoc(chatRef);


    const sellerId =
        materialData.uploadedBy;

    if (!sellerId || (currentUser.uid !== sellerId && otherUserId !== sellerId)) {
        if (materialTitleElement) {
            materialTitleElement.textContent =
                "This conversation link does not match the listing.";
        }
        return null;
    }

    const existingData = existingChat.exists()
        ? existingChat.data()
        : null;

    if (existingData) {
        const expectedBuyerId =
            currentUser.uid === sellerId ? otherUserId : currentUser.uid;
        const participants = Array.isArray(existingData.participants)
            ? existingData.participants
            : [];
        const matchesConversation =
            (!existingData.sellerId || existingData.sellerId === sellerId) &&
            (!existingData.buyerId || existingData.buyerId === expectedBuyerId) &&
            (participants.length
                ? participants.includes(sellerId) && participants.includes(expectedBuyerId)
                : existingData.sellerId === sellerId && existingData.buyerId === expectedBuyerId);

        if (!matchesConversation) {
            if (materialTitleElement) {
                materialTitleElement.textContent =
                    "This conversation does not match the listing.";
            }
            return null;
        }
    } else if (currentUser.uid === sellerId) {
        // Sellers can reopen conversations from the chat list, but a seller
        // should not create a conversation for an arbitrary buyer ID.
        if (materialTitleElement) {
            materialTitleElement.textContent =
                "This conversation could not be found.";
        }
        return null;
    }

    const sellerName =
        materialData.uploaderName ||
        "Seller";


    let buyerId = "";
    let buyerName = "";


    /* CURRENT USER IS SELLER */

    if (
        currentUser.uid === sellerId
    ) {

        buyerId =
            otherUserId;

        if (existingChat.exists()) {

            buyerName =
                existingData.buyerName ||
                "Buyer";

        } else {

            buyerName =
                "Buyer";
        }

    }


    /* CURRENT USER IS BUYER */

    else {

        buyerId =
            currentUser.uid;

        buyerName =
            getCurrentUserName();
    }


    const chatData = {

        participants: [
            sellerId,
            buyerId
        ].sort(),

        buyerId:
            buyerId,

        buyerName:
            buyerName,

        sellerId:
            sellerId,

        sellerName:
            sellerName,

        materialId:
            materialId,

        materialTitle:
            materialData.title ||
            "Untitled Material",

        materialPrice:
            materialData.isFree
                ? 0
                : Number(
                    materialData.price || 0
                ),

        updatedAt:
            serverTimestamp()
    };


    if (existingData) {
        const chatUpdate = { updatedAt: serverTimestamp() };
        if (!Array.isArray(existingData.participants) || existingData.participants.length !== 2) {
            chatUpdate.participants = chatData.participants;
        }
        if (!existingData.buyerId) chatUpdate.buyerId = buyerId;
        if (!existingData.sellerId) chatUpdate.sellerId = sellerId;
        if (!existingData.buyerName) chatUpdate.buyerName = buyerName;
        if (!existingData.sellerName) chatUpdate.sellerName = sellerName;
        await setDoc(chatRef, chatUpdate, { merge: true });
    } else {
        await setDoc(chatRef, chatData, { merge: true });
    }


    return {
        chatId,
        chatRef
    };
}


/* =========================================================
    UPDATE HEADER
========================================================= */

async function updateHeader(chatRef) {

    try {

        const chatDoc =
            await getDoc(chatRef);

        if (!chatDoc.exists()) {
            return;
        }

        const chatData =
            chatDoc.data();


        if (
            currentUser.uid ===
            chatData.sellerId
        ) {

            otherPersonName =
                chatData.buyerName ||
                "Buyer";

        } else {

            otherPersonName =
                chatData.sellerName ||
                "Seller";
        }


        if (sellerNameElement) {

            sellerNameElement.textContent =
                otherPersonName;
        }

    }
    catch (error) {

        console.error(
            "Header error:",
            error
        );
    }
}


/* =========================================================
    LOAD REAL-TIME MESSAGES
========================================================= */

async function loadMessages(chatId) {

    if (!messagesContainer) {
        return;
    }

    if (unsubscribeMessages) {

        unsubscribeMessages();

        unsubscribeMessages = null;
    }


    /* A clear action hides only this user's older messages. */
    try {

        const chatSnapshot =
            await getDoc(
                doc(db, "chats", chatId)
            );

        const clearedAt =
            chatSnapshot.data()?.clearedAtBy?.[
                currentUser?.uid
            ];

        clearedMessagesBefore =
            clearedAt?.toMillis?.() || 0;

    }
    catch (error) {

        console.warn(
            "Could not load cleared-chat state:",
            error
        );

        clearedMessagesBefore = 0;

    }


    const messagesRef =
        collection(
            db,
            "chats",
            chatId,
            "messages"
        );


    unsubscribeMessages =
        onSnapshot(
            messagesRef,
            function (snapshot) {

                messagesContainer.innerHTML = "";


                if (snapshot.empty) {

                    messagesContainer.innerHTML = `
                        <div class="chat-empty">
                            <div style="
                                font-size:36px;
                                margin-bottom:10px;
                            ">
                                💬
                            </div>

                            <strong>
                                No messages yet
                            </strong>

                            <p>
                                Start the conversation!
                            </p>
                        </div>
                    `;

                    return;
                }


                const messages = [];


                snapshot.forEach(
                    function (messageDoc) {

                        messages.push({
                            id: messageDoc.id,
                            ...messageDoc.data()
                        });

                    }
                );


                /* SORT BY TIME */

                messages.sort(
                    function (a, b) {

                        const timeA =
                            a.createdAt?.toMillis?.() ||
                            0;

                        const timeB =
                            b.createdAt?.toMillis?.() ||
                            0;

                        return timeA - timeB;
                    }
                );


                /* DISPLAY */

                const visibleMessages =
                    messages.filter(
                    function (message) {

                        const messageTime =
                            message.createdAt?.toMillis?.() || 0;

                        return (
                            !clearedMessagesBefore ||
                            !messageTime ||
                            messageTime >
                                clearedMessagesBefore
                        );

                    }
                );


                if (visibleMessages.length === 0) {

                    messagesContainer.innerHTML = `
                        <div class="chat-empty">
                            <div style="font-size:36px; margin-bottom:10px;">
                                💬
                            </div>
                            <strong>Chat cleared</strong>
                            <p>New messages will appear here.</p>
                        </div>
                    `;

                    return;

                }


                visibleMessages.forEach(
                    function (message) {

                        renderMessage(
                            message
                        );

                    }
                );


                /* SCROLL TO BOTTOM */

                setTimeout(
                    function () {

                        messagesContainer.scrollTop =
                            messagesContainer.scrollHeight;

                    },
                    50
                );

            },

            function (error) {

                console.error(
                    "Message listener error:",
                    error
                );

                messagesContainer.innerHTML = `
                    <div class="chat-empty">
                        <strong>
                            Could not load messages
                        </strong>

                        <p>
                            ${error.message}
                        </p>
                    </div>
                `;

            }
        );
}


/* =========================================================
    RENDER MESSAGE
========================================================= */

function renderMessage(message) {

    if (!messagesContainer) {
        return;
    }


    const isMine =
        currentUser &&
        message.senderId ===
        currentUser.uid;


    const messageWrapper =
        document.createElement("div");


    messageWrapper.className =
        isMine
            ? "message-wrapper message-mine"
            : "message-wrapper message-other";


    const messageBubble =
        document.createElement("div");


    messageBubble.className =
        "message-bubble";


    /* MESSAGE TEXT */

    const textElement =
        document.createElement("div");

    textElement.className =
        "message-text";

    textElement.textContent =
        message.text || "";


    messageBubble.appendChild(
        textElement
    );


    /* TIME */

    const timeElement =
        document.createElement("div");

    timeElement.className =
        "message-time";


    if (
        message.createdAt &&
        message.createdAt.toDate
    ) {

        const date =
            message.createdAt.toDate();


        timeElement.textContent =
            date.toLocaleTimeString(
                [],
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );

    } else {

        timeElement.textContent =
            "Sending...";
    }


    messageBubble.appendChild(
        timeElement
    );


    messageWrapper.appendChild(
        messageBubble
    );


    messagesContainer.appendChild(
        messageWrapper
    );
}


/* =========================================================
    SEND MESSAGE
========================================================= */

async function sendMessage(chatId) {

    if (!currentUser) {

        alert(
            "Please login before sending a message."
        );

        return;
    }


    if (!messageInput) {

        alert(
            "Message input was not found."
        );

        return;
    }


    const text =
        messageInput.value.trim();


    if (!text) {
        return;
    }


    if (!chatId) {

        alert(
            "Chat could not be identified."
        );

        return;
    }


    /* DISABLE BUTTON */

    if (sendBtn) {

        sendBtn.disabled =
            true;
    }


    try {

        const messagesRef =
            collection(
                db,
                "chats",
                chatId,
                "messages"
            );


        /* ADD MESSAGE */

        await addDoc(
            messagesRef,
            {

                text:
                    text,

                senderId:
                    currentUser.uid,

                senderName:
                    getCurrentUserName(),

                createdAt:
                    serverTimestamp()

            }
        );


        /* UPDATE CHAT */

        await setDoc(
            doc(
                db,
                "chats",
                chatId
            ),
            {

                lastMessage:
                    text,

                lastMessageSenderId:
                    currentUser.uid,

                lastMessageSenderName:
                    getCurrentUserName(),

                updatedAt:
                    serverTimestamp(),

                unreadCounts: {
                    [currentUser.uid]: 0,
                    [otherUserId]: increment(1)
                }

            },
            {
                merge: true
            }
        );


        /* CLEAR INPUT */

        messageInput.value = "";

        messageInput.focus();


        console.log(
            "✓ Message sent"
        );

    }
    catch (error) {

        console.error(
            "Send message error:",
            error
        );

        alert(
            "Could not send message:\n\n" +
            error.message
        );

    }
    finally {

        if (sendBtn) {

            sendBtn.disabled =
                false;
        }

    }
}


/* =========================================================
    SEND BUTTON
========================================================= */

if (sendBtn) {

    sendBtn.addEventListener(
        "click",
        async function (event) {

            event.preventDefault();
            event.stopPropagation();


            console.log(
                "Send button clicked"
            );


            if (!currentUser) {

                alert(
                    "Please login again."
                );

                return;
            }


            if (
                !otherUserId ||
                !materialId
            ) {

                alert(
                    "Chat information is missing."
                );

                console.error({
                    otherUserId,
                    materialId
                });

                return;
            }


            const chatId =
                createChatId(
                    currentUser.uid,
                    otherUserId,
                    materialId
                );


            await sendMessage(
                chatId
            );

        }
    );

}


/* =========================================================
    ENTER TO SEND
========================================================= */

if (messageInput) {

    messageInput.addEventListener(
        "keydown",
        async function (event) {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();


                if (
                    !currentUser ||
                    !otherUserId ||
                    !materialId
                ) {

                    return;
                }


                const chatId =
                    createChatId(
                        currentUser.uid,
                        otherUserId,
                        materialId
                    );


                await sendMessage(
                    chatId
                );

            }

        }
    );

}


/* =========================================================
    SEARCH MESSAGES
========================================================= */

function performMessageSearch() {

    if (!messagesContainer || !chatSearchInput) {
        return;
    }

    const searchText =
        chatSearchInput.value
            .trim()
            .toLowerCase();


    const messageElements =
        messagesContainer.querySelectorAll(
            ".message-wrapper"
        );


    let matches = 0;


    messageElements.forEach(
        function (messageElement) {

            const text =
                messageElement
                    .querySelector(".message-text")
                    ?.textContent
                    .toLowerCase() || "";


            if (!searchText) {

                messageElement.style.display =
                    "";

                return;
            }


            if (
                text.includes(searchText)
            ) {

                messageElement.style.display =
                    "";

                matches++;

            } else {

                messageElement.style.display =
                    "none";
            }

        }
    );


    if (searchResultCount) {

        searchResultCount.textContent =
            matches;
    }
}


/* =========================================================
    SEARCH INPUT
========================================================= */

if (chatSearchInput) {

    chatSearchInput.addEventListener(
        "input",
        function () {

            performMessageSearch();

        }
    );

}


/* =========================================================
    CLOSE SEARCH
========================================================= */

if (closeSearchBtn) {

    closeSearchBtn.addEventListener(
        "click",
        function (event) {

            event.preventDefault();
            event.stopPropagation();


            if (chatSearchBar) {

                chatSearchBar.classList.remove(
                    "active"
                );

                chatSearchBar.style.display =
                    "none";
            }


            if (chatSearchInput) {

                chatSearchInput.value = "";
            }


            if (searchResultCount) {

                searchResultCount.textContent =
                    "0";
            }


            /* SHOW ALL MESSAGES AGAIN */

            if (messagesContainer) {

                const messageElements =
                    messagesContainer.querySelectorAll(
                        ".message-wrapper"
                    );


                messageElements.forEach(
                    function (element) {

                        element.style.display =
                            "";

                    }
                );

            }

        }
    );

}


/* =========================================================
    CLEAR CHAT
========================================================= */

if (clearChatBtn) {

    clearChatBtn.addEventListener(
        "click",
        async function (event) {

            event.preventDefault();
            event.stopPropagation();


            if (
                !currentUser ||
                !otherUserId ||
                !materialId
            ) {

                alert(
                    "Chat information is missing."
                );

                return;
            }


            const confirmed =
                confirm(
                    "Delete all messages in this chat?"
                );


            if (!confirmed) {
                return;
            }


            const chatId =
                createChatId(
                    currentUser.uid,
                    otherUserId,
                    materialId
                );


            try {

                clearChatBtn.disabled =
                    true;


                await setDoc(
                    doc(
                        db,
                        "chats",
                        chatId
                    ),
                    {

                        clearedAtBy: {
                            [currentUser.uid]:
                                serverTimestamp()
                        }

                    },
                    {
                        merge: true
                    }
                );


                clearedMessagesBefore =
                    Date.now();

                messagesContainer.innerHTML = `
                    <div class="chat-empty">
                        <div style="font-size:36px; margin-bottom:10px;">
                            💬
                        </div>
                        <strong>Chat cleared</strong>
                        <p>New messages will appear here.</p>
                    </div>
                `;


                closeChatMenu();


                console.log(
                    "✓ Chat cleared"
                );

            }
            catch (error) {

                console.error(
                    "Clear chat error:",
                    error
                );


                alert(
                    "Could not clear chat:\n\n" +
                    error.message
                );

            }
            finally {

                if (clearChatBtn) {

                    clearChatBtn.disabled =
                        false;

                }

            }

        }
    );

}


/* =========================================================
    BACK BUTTON
========================================================= */

if (backBtn) {

    backBtn.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            window.history.back();

        }
    );

}


/* =========================================================
    INITIALIZE CHAT
========================================================= */

async function initializeChat() {

    console.log(
        "Initializing Book Sahayak chat..."
    );


    /* CHECK PARAMETERS */

    if (!otherUserId) {

        console.error(
            "Missing user parameter."
        );

        if (messagesContainer) {

            messagesContainer.innerHTML = `
                <div class="chat-empty">
                    <strong>Chat unavailable</strong>
                    <p>User information is missing.</p>
                </div>
            `;
        }

        return;
    }


    if (!materialId) {

        console.error(
            "Missing material parameter."
        );

        if (messagesContainer) {

            messagesContainer.innerHTML = `
                <div class="chat-empty">
                    <strong>Chat unavailable</strong>
                    <p>Material information is missing.</p>
                </div>
            `;
        }

        return;
    }


    /* LOAD MATERIAL */

    const materialLoaded =
        await loadMaterial();


    if (!materialLoaded) {
        return;
    }


    /* CREATE / LOAD CHAT */

    const chat =
        await setupChat();


    if (!chat) {

        console.error(
            "Could not initialize chat."
        );

        return;
    }

    /* Mark messages as read when this participant opens the chat. */
    await setDoc(
        chat.chatRef,
        {
            unreadCounts: {
                [currentUser.uid]: 0
            }
        },
        {
            merge: true
        }
    );


    /* UPDATE HEADER */

    await updateHeader(
        chat.chatRef
    );


    /* LOAD MESSAGES */

    loadMessages(
        chat.chatId
    );


    console.log(
        "✓ Chat initialized successfully"
    );

}


/* =========================================================
    AUTHENTICATION
========================================================= */

onAuthStateChanged(
    auth,
    async function (user) {

        console.log(
            "Auth state:",
            user
                ? user.uid
                : "Not logged in"
        );


        if (!user) {

            currentUser = null;


            if (messagesContainer) {

                messagesContainer.innerHTML = `
                    <div class="chat-empty">
                        <strong>Login required</strong>
                        <p>Please login to use chat.</p>
                    </div>
                `;

            }


            return;
        }


        currentUser =
            user;


        try {

            await initializeChat();

        }
        catch (error) {

            console.error(
                "Chat initialization error:",
                error
            );


            if (messagesContainer) {

                messagesContainer.innerHTML = `
                    <div class="chat-empty">
                        <strong>
                            Something went wrong
                        </strong>

                        <p>
                            ${error.message}
                        </p>
                    </div>
                `;

            }

        }

    }
);


/* =========================================================
    MOBILE KEYBOARD SUPPORT
========================================================= */

if (messageInput) {

    messageInput.addEventListener(
        "focus",
        function () {

            setTimeout(
                function () {

                    if (messagesContainer) {

                        messagesContainer.scrollTop =
                            messagesContainer.scrollHeight;

                    }

                },
                300
            );

        }
    );

}


/* =========================================================
    CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    function () {

        if (unsubscribeMessages) {

            unsubscribeMessages();

            unsubscribeMessages = null;
        }

    }
);


/* =========================================================
    DEBUG INFORMATION
========================================================= */

console.log(
    "Book Sahayak chat.js loaded."
);

console.log(
    "User ID:",
    otherUserId
);

console.log(
    "Material ID:",
    materialId
);

/* =========================================================
   FINAL CHAT ACTION CONTROLS
   One handler per control; header More and composer Options
   intentionally open different menus.
========================================================= */
(function installChatControls() {
    const menu = document.getElementById("chatMenu");
    const optionsMenu = document.getElementById("messageOptionsMenu");
    const searchBar = document.getElementById("chatSearchBar");
    const searchBtn = document.getElementById("chatSearchBtn");
    const moreBtn = document.getElementById("chatMoreBtn");
    const optionsBtn = document.getElementById("messageOptionsBtn");
    const theme = document.getElementById("themeBtn");
    const input = document.getElementById("messageInput");

    function show(el) {
        if (!el) return;
        el.classList.add("active");
        el.setAttribute("aria-hidden", "false");
    }
    function hide(el) {
        if (!el) return;
        el.classList.remove("active");
        el.setAttribute("aria-hidden", "true");
    }
    function hideMenus() { hide(menu); hide(optionsMenu); }

    function toggleTheme(e) {
        e.preventDefault(); e.stopPropagation();
        const light = document.body.classList.toggle("light-theme");
        if (theme) theme.textContent = light ? "☀️" : "🌙";
        try { localStorage.setItem("chatTheme", light ? "light" : "dark"); } catch (_) {}
    }

    searchBtn?.addEventListener("click", e => {
        e.preventDefault(); e.stopPropagation();
        hideMenus();
        if (searchBar) {
            searchBar.classList.add("active");
            searchBar.style.display = "flex";
            setTimeout(() => document.getElementById("chatSearchInput")?.focus(), 50);
        }
    });

    moreBtn?.addEventListener("click", e => {
        e.preventDefault(); e.stopPropagation();
        hide(optionsMenu);
        if (menu?.classList.contains("active")) hide(menu); else show(menu);
    });

    optionsBtn?.addEventListener("click", e => {
        e.preventDefault(); e.stopPropagation();
        hide(menu);
        if (optionsMenu?.classList.contains("active")) hide(optionsMenu); else show(optionsMenu);
    });

    theme?.addEventListener("click", toggleTheme);

    document.getElementById("closeChatMenuBtn")?.addEventListener("click", e => {
        e.preventDefault(); e.stopPropagation(); hide(menu);
    });

    clearDraftBtn?.addEventListener("click", e => {
        e.preventDefault(); e.stopPropagation();
        if (input) { input.value = ""; input.focus(); }
        hide(optionsMenu);
    });

    emojiOptionBtn?.addEventListener("click", e => {
        e.preventDefault(); e.stopPropagation();
        if (input) { input.value += (input.value ? " " : "") + "😊"; input.focus(); }
        hide(optionsMenu);
    });

    document.addEventListener("click", e => {
        if (menu && !menu.contains(e.target) && !moreBtn?.contains(e.target)) hide(menu);
        if (optionsMenu && !optionsMenu.contains(e.target) && !optionsBtn?.contains(e.target)) hide(optionsMenu);
    });

    document.addEventListener("keydown", e => {
        if (e.key === "Escape") { hideMenus(); }
    });

    let touchSending = false;
    sendBtn?.addEventListener("touchend", async e => {
        e.preventDefault();
        if (touchSending) return;
        touchSending = true;
        try { sendBtn.click(); } finally { setTimeout(() => { touchSending = false; }, 400); }
    }, { passive: false });

    try {
        const saved = localStorage.getItem("chatTheme");
        if (saved === "light") {
            document.body.classList.add("light-theme");
            if (theme) theme.textContent = "☀️";
        }
    } catch (_) {}
})();
