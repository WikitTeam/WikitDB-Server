/**
 * TTL 内存缓存
 * 支持不同过期时间，自动清理过期条目
 */

const store = new Map();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 分钟
const MAX_ENTRIES = 500;
let cleanupTimer = null;

function startCleanup() {
    if (cleanupTimer) return;
    cleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of store) {
            if (now > entry.expiresAt) store.delete(key);
        }
        if (store.size === 0) {
            clearInterval(cleanupTimer);
            cleanupTimer = null;
        }
    }, 60 * 1000);
    if (cleanupTimer.unref) cleanupTimer.unref();
}

/**
 * 获取缓存值
 * @param {string} key
 * @returns {*} 缓存值或 undefined
 */
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

/**
 * 设置缓存
 * @param {string} key
 * @param {*} value
 * @param {number} ttl 毫秒，默认 5 分钟
 */
function set(key, value, ttl = DEFAULT_TTL) {
    if (store.size >= MAX_ENTRIES) {
        let oldest = null, oldestKey = null;
        for (const [k, v] of store) {
            if (!oldest || v.lastAccess < oldest.lastAccess) {
                oldest = v;
                oldestKey = k;
            }
        }
        if (oldestKey) store.delete(oldestKey);
    }
    store.set(key, { value, expiresAt: Date.now() + ttl, lastAccess: Date.now() });
    startCleanup();
}

/**
 * 删除缓存
 */
function del(key) {
    store.delete(key);
}

/**
 * 清空所有缓存
 */
function flush() {
    store.clear();
}

/**
 * 带缓存的异步函数包装器
 * @param {string} key 缓存键
 * @param {Function} fn 异步函数
 * @param {number} ttl 缓存时间（毫秒）
 */
async function cached(key, fn, ttl = DEFAULT_TTL) {
    const hit = get(key);
    if (hit !== undefined) return hit;
    const result = await fn();
    set(key, result, ttl);
    return result;
}

module.exports = { get, set, del, flush, cached };
