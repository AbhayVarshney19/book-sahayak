const MAX_RECENT_LISTINGS = 40;

function storageKey(userId) {
    return `bookSahayak:recentlyViewed:${userId}`;
}

export function getRecentListings(userId) {
    if (!userId) return [];
    try {
        const saved = JSON.parse(localStorage.getItem(storageKey(userId)) || "[]");
        if (!Array.isArray(saved)) return [];
        return saved
            .filter((entry) => entry && typeof entry.id === "string" && entry.id.length > 0)
            .slice(0, MAX_RECENT_LISTINGS);
    } catch (error) {
        console.warn("Could not read recently viewed listings:", error);
        return [];
    }
}

export function recordRecentListing(userId, materialId) {
    if (!userId || !materialId) return;
    const next = [
        { id: materialId, viewedAt: Date.now() },
        ...getRecentListings(userId).filter((entry) => entry.id !== materialId)
    ].slice(0, MAX_RECENT_LISTINGS);
    try {
        localStorage.setItem(storageKey(userId), JSON.stringify(next));
    } catch (error) {
        console.warn("Could not save recently viewed listing:", error);
    }
}

export function removeRecentListing(userId, materialId) {
    if (!userId || !materialId) return;
    try {
        const next = getRecentListings(userId).filter((entry) => entry.id !== materialId);
        localStorage.setItem(storageKey(userId), JSON.stringify(next));
    } catch (error) {
        console.warn("Could not update recently viewed listings:", error);
    }
}

export function clearRecentListings(userId) {
    if (!userId) return;
    try {
        localStorage.removeItem(storageKey(userId));
    } catch (error) {
        console.warn("Could not clear recently viewed listings:", error);
    }
}
