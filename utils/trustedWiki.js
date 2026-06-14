const config = require('../wikitdb.config.js');

function normalizeOrigin(value) {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:') return null;
        if (url.username || url.password) return null;
        return url.origin.toLowerCase();
    } catch {
        return null;
    }
}

export function getTrustedWikiByUrl(value) {
    const requestedOrigin = normalizeOrigin(value);
    if (!requestedOrigin) return null;

    return config.SUPPORT_WIKI.find((wiki) => (
        normalizeOrigin(wiki.URL) === requestedOrigin
    )) || null;
}
