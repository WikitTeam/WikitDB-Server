const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeRichHtml } = require('../utils/htmlSanitizer');

test('removes executable HTML and event handlers', () => {
    const result = sanitizeRichHtml(
        '<svg onload=alert(1)></svg><img src="https://example.com/x" onerror=alert(1)>'
    );

    assert.doesNotMatch(result, /svg|onload|onerror|alert/i);
    assert.match(result, /<img src="https:\/\/example\.com\/x" \/>/);
});

test('removes unsafe URL schemes', () => {
    const result = sanitizeRichHtml(
        '<a href="javascript:alert(1)">bad</a><a href="https://example.com">good</a>'
    );

    assert.doesNotMatch(result, /javascript:/i);
    assert.match(result, /https:\/\/example\.com/);
    assert.match(result, /noopener noreferrer nofollow/);
});

test('drops iframe and srcdoc payloads', () => {
    const result = sanitizeRichHtml(
        '<iframe srcdoc="<script>alert(1)</script>"></iframe><p>safe</p>'
    );

    assert.equal(result, '<p>safe</p>');
});
