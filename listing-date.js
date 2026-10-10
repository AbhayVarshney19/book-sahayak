export function formatListingDateTime(timestamp) {
    try {
        const date = typeof timestamp?.toDate === "function"
            ? timestamp.toDate()
            : timestamp instanceof Date
                ? timestamp
                : timestamp
                    ? new Date(timestamp)
                    : null;
        if (!date || Number.isNaN(date.getTime())) return "Date unavailable";
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(date);
    } catch {
        return "Date unavailable";
    }
}
