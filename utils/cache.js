/**
 * 单实例 TTL 缓存。
 * 无服务器函数不能靠 setInterval 打扫（会拖住实例），读取时顺手丢掉过期项。
 * 命中范围只在当前温实例内；跨实例共享的数据放数据库或 Upstash。
 */

const store = new Map();

const DEFAULT_TTL = 5 * 60 * 1000;
const MAX_ENTRIES = 500;

function get(key) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return undefined;
    }
    entry.lastAccess = Date.now();
    return entry.value;
}

function set(key, value, ttl = DEFAULT_TTL) {
    if (store.size >= MAX_ENTRIES) {
        let oldest = null;
        let oldestKey = null;
        for (const [k, v] of store) {
            if (!oldest || v.lastAccess < oldest.lastAccess) {
                oldest = v;
                oldestKey = k;
            }
        }
        if (oldestKey) store.delete(oldestKey);
    }
    store.set(key, { value, expiresAt: Date.now() + ttl, lastAccess: Date.now() });
}

function del(key) {
    store.delete(key);
}

function flush() {
    store.clear();
}

async function cached(key, fn, ttl = DEFAULT_TTL) {
    const hit = get(key);
    if (hit !== undefined) return hit;
    const result = await fn();
    set(key, result, ttl);
    return result;
}

module.exports = { get, set, del, flush, cached };
