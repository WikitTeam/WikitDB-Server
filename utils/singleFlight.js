/**
 * Single-flight 请求去重
 * 同一时刻多个调用者请求同一个 key，只执行一次 fn，其余等待复用结果
 */

const inflight = new Map();

/**
 * @param {string} key 去重键
 * @param {Function} fn 异步函数
 * @returns {Promise<*>} fn 的结果
 */
async function singleFlight(key, fn) {
    if (inflight.has(key)) {
        return inflight.get(key);
    }

    const promise = fn().finally(() => {
        inflight.delete(key);
    });

    inflight.set(key, promise);
    return promise;
}

module.exports = { singleFlight };
