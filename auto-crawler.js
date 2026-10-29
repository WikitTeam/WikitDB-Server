/**
 * 一次性爬虫 / 备份入口。进程跑完就退出，不再常驻，也不再内置 node-cron。
 *
 *   node auto-crawler.js                 把当前这一轮爬完（切片续跑）后退出
 *   node auto-crawler.js --for 480       最多跑 480 秒，游标留下次继续
 *   node auto-crawler.js --slice         只跑一个默认时间片（约 45 秒）
 *   node auto-crawler.js --backup        调 wikit CLI 做全站备份（不能在 Vercel 函数里跑）
 *   node auto-crawler.js --force         忽略 3 小时冷却，立刻开新一轮
 */
const { runCrawlSlice, runBackup } = require('./jobs/crawler');

function argNumber(flag) {
    const index = process.argv.indexOf(flag);
    if (index === -1 || process.argv[index + 1] == null) return null;
    const value = Number(process.argv[index + 1]);
    return Number.isFinite(value) ? value : null;
}

async function main() {
    const force = process.argv.includes('--force');
    if (process.argv.includes('--backup')) {
        const result = await runBackup();
        console.log(JSON.stringify(result));
        if (result && result.exitCode && result.exitCode !== 0) process.exitCode = result.exitCode;
        return;
    }

    if (process.argv.includes('--slice')) {
        const result = await runCrawlSlice({ force });
        console.log(JSON.stringify(result));
        return;
    }

    const forSec = argNumber('--for');
    const deadline = forSec == null ? Infinity : Date.now() + forSec * 1000;
    let last = null;
    while (Date.now() < deadline) {
        last = await runCrawlSlice({ force });
        if (!last || last.skipped || last.done || last.error) break;
    }
    console.log(JSON.stringify(last));
}

main()
    .then(() => process.exit(process.exitCode || 0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
