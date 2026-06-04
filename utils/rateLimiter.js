/**
 * Token Bucket 令牌桶限速器
 * 比滑动窗口更平滑，适合控制对外部 API 的请求频率
 */

class TokenBucket {
    /**
     * @param {number} rate 每秒补充的令牌数
     * @param {number} burst 桶容量（最大突发量）
     */
    constructor(rate, burst) {
        this.rate = rate;
        this.burst = burst;
        this.tokens = burst;
        this.lastRefill = Date.now();
    }

    _refill() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        this.tokens = Math.min(this.burst, this.tokens + elapsed * this.rate);
        this.lastRefill = now;
    }

    /**
     * 尝试消费一个令牌
     * @returns {boolean} true = 允许通过，false = 被限速
     */
    consume() {
        this._refill();
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return true;
        }
        return false;
    }

    /**
     * 等待直到有令牌可用
     * @param {number} timeoutMs 最大等待时间
     * @returns {Promise<boolean>} true = 获取到令牌，false = 超时
     */
    async wait(timeoutMs = 5000) {
        const start = Date.now();
        while (!this.consume()) {
            if (Date.now() - start > timeoutMs) return false;
            const waitMs = Math.ceil(1000 / this.rate);
            await new Promise(r => setTimeout(r, Math.min(waitMs, 100)));
        }
        return true;
    }
}

// 预置的外部 API 限速器
const wikitLimiter = new TokenBucket(2, 5);     // 2 请求/秒，突发 5
const wikidotLimiter = new TokenBucket(0.5, 2); // 0.5 请求/秒，突发 2

module.exports = { TokenBucket, wikitLimiter, wikidotLimiter };
