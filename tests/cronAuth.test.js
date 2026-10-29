const test = require('node:test');
const assert = require('node:assert/strict');
const { authorizeCron } = require('../utils/cronAuth');
const { normalizeLines } = require('../utils/jobLog');

function withEnv(patch, fn) {
    const previous = {};
    for (const key of Object.keys(patch)) {
        previous[key] = process.env[key];
        if (patch[key] == null) delete process.env[key];
        else process.env[key] = patch[key];
    }
    try {
        return fn();
    } finally {
        for (const key of Object.keys(patch)) {
            if (previous[key] == null) delete process.env[key];
            else process.env[key] = previous[key];
        }
    }
}

test('cron auth fails closed without a secret', () => {
    withEnv({ CRON_SECRET: null, ALLOW_INSECURE_CRON: null, NODE_ENV: 'production', VERCEL: '1' }, () => {
        assert.equal(authorizeCron({ headers: { authorization: 'Bearer whatever-token' } }), false);
    });
});

test('cron auth accepts the bearer secret and rejects a mismatch', () => {
    withEnv({ CRON_SECRET: 'cron-secret-value-32chars!!', ALLOW_INSECURE_CRON: null, NODE_ENV: 'production', VERCEL: '1' }, () => {
        assert.equal(authorizeCron({ headers: { authorization: 'Bearer cron-secret-value-32chars!!' } }), true);
        assert.equal(authorizeCron({ headers: { 'x-cron-secret': 'cron-secret-value-32chars!!' } }), true);
        assert.equal(authorizeCron({ headers: { authorization: 'Bearer nope' } }), false);
        assert.equal(authorizeCron({ headers: {} }), false);
    });
});

test('job log normalizes stored lines', () => {
    assert.deepEqual(normalizeLines({ lines: ['a', 'b'] }), ['a', 'b']);
    assert.deepEqual(normalizeLines('["a"]'), ['a']);
    assert.deepEqual(normalizeLines(null), []);
});
