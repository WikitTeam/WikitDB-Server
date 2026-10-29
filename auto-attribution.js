/**
 * 一次性归属同步。跑完退出。
 *
 *   node auto-attribution.js
 *   node auto-attribution.js --for 300
 *   node auto-attribution.js --slice
 *   node auto-attribution.js --force
 */
const { runAttributionSlice } = require('./jobs/attribution');

function argNumber(flag) {
    const index = process.argv.indexOf(flag);
    if (index === -1 || process.argv[index + 1] == null) return null;
    const value = Number(process.argv[index + 1]);
    return Number.isFinite(value) ? value : null;
}

async function main() {
    const force = process.argv.includes('--force');
    if (process.argv.includes('--slice')) {
        console.log(JSON.stringify(await runAttributionSlice({ force })));
        return;
    }
    const forSec = argNumber('--for');
    const deadline = forSec == null ? Infinity : Date.now() + forSec * 1000;
    let last = null;
    while (Date.now() < deadline) {
        last = await runAttributionSlice({ force });
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
