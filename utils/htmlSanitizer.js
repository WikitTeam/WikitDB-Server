const sanitizeHtmlLibrary = require('sanitize-html');

const COMMON_OPTIONS = {
    allowedTags: [
        'a', 'abbr', 'b', 'blockquote', 'br', 'code', 'del', 'div', 'em',
        'h1', 'h2', 'h3', 'h4', 'hr', 'i', 'img', 'li', 'ol', 'p', 'pre',
        'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'th', 'thead',
        'tr', 'u', 'ul'
    ],
    allowedAttributes: {
        a: ['href', 'title', 'rel', 'target'],
        img: ['src', 'alt', 'title'],
        '*': ['class']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
        img: ['http', 'https']
    },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
        a: sanitizeHtmlLibrary.simpleTransform('a', {
            rel: 'noopener noreferrer nofollow',
            target: '_blank'
        })
    }
};

function sanitizeRichHtml(value) {
    if (typeof value !== 'string') return '';
    return sanitizeHtmlLibrary(value, COMMON_OPTIONS);
}

function sanitizeHistoryHtml(value) {
    return sanitizeRichHtml(value);
}

module.exports = { sanitizeRichHtml, sanitizeHistoryHtml };
