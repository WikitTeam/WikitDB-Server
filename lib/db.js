const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');

// --- File I/O ---

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

const collections = {};

function loadCollection(name) {
    if (collections[name]) return collections[name];
    ensureDataDir();
    const filePath = path.join(DATA_DIR, `${name}.json`);
    if (fs.existsSync(filePath)) {
        try {
            collections[name] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch {
            collections[name] = { nextId: 1, records: [] };
        }
    } else {
        collections[name] = { nextId: 1, records: [] };
    }
    return collections[name];
}

function saveCollection(name) {
    ensureDataDir();
    const filePath = path.join(DATA_DIR, `${name}.json`);
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(collections[name], null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
}

// --- Write Lock ---

let writeLock = Promise.resolve();

function withLock(fn) {
    const prev = writeLock;
    let release;
    writeLock = new Promise(r => { release = r; });
    return prev.then(async () => {
        try { return await fn(); }
        finally { release(); }
    });
}

// --- DecimalValue ---

class DecimalValue {
    constructor(value) { this.value = parseFloat(Number(value).toFixed(2)); }
    lt(other) { return this.value < Number(other); }
    lte(other) { return this.value <= Number(other); }
    gt(other) { return this.value > Number(other); }
    gte(other) { return this.value >= Number(other); }
    toNumber() { return this.value; }
    toString() { return this.value.toFixed(2); }
    toJSON() { return this.value; }
    valueOf() { return this.value; }
}

// --- Query Engine ---

function matchesWhere(record, where) {
    if (!where) return true;
    for (const [key, condition] of Object.entries(where)) {
        if (key === 'AND') {
            if (!condition.every(c => matchesWhere(record, c))) return false;
            continue;
        }
        if (key === 'OR') {
            if (!condition.some(c => matchesWhere(record, c))) return false;
            continue;
        }
        if (key === 'NOT') {
            if (matchesWhere(record, condition)) return false;
            continue;
        }
        const value = record[key];
        if (condition === null || condition === undefined) {
            if (value !== condition) return false;
        } else if (typeof condition === 'object' && !Array.isArray(condition) && !(condition instanceof Date)) {
            if ('contains' in condition) {
                const caseSensitive = condition.mode !== 'insensitive';
                const v = String(value || '');
                const c = String(condition.contains);
                if (caseSensitive ? !v.includes(c) : !v.toLowerCase().includes(c.toLowerCase())) return false;
            }
            if ('startsWith' in condition && !String(value || '').startsWith(condition.startsWith)) return false;
            if ('endsWith' in condition && !String(value || '').endsWith(condition.endsWith)) return false;
            if ('in' in condition && !condition.in.includes(value)) return false;
            if ('notIn' in condition && condition.notIn.includes(value)) return false;
            if ('gte' in condition && !(value >= condition.gte)) return false;
            if ('gt' in condition && !(value > condition.gt)) return false;
            if ('lte' in condition && !(value <= condition.lte)) return false;
            if ('lt' in condition && !(value < condition.lt)) return false;
            if ('not' in condition && value === condition.not) return false;
        } else {
            if (value !== condition) return false;
        }
    }
    return true;
}

function applyOrderBy(records, orderBy) {
    if (!orderBy) return records;
    const entries = typeof orderBy === 'object' ? Object.entries(orderBy) : [];
    if (entries.length === 0) return records;
    return [...records].sort((a, b) => {
        for (const [field, dir] of entries) {
            const av = a[field], bv = b[field];
            if (av < bv) return dir === 'desc' ? 1 : -1;
            if (av > bv) return dir === 'desc' ? -1 : 1;
        }
        return 0;
    });
}

function applySelect(record, select) {
    if (!select) return record;
    const result = {};
    for (const key of Object.keys(select)) {
        if (select[key]) result[key] = record[key];
    }
    return result;
}

function applyDataUpdate(record, data) {
    for (const [key, val] of Object.entries(data)) {
        if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
            if ('increment' in val) {
                record[key] = parseFloat((Number(record[key] || 0) + Number(val.increment)).toFixed(2));
                continue;
            }
            if ('decrement' in val) {
                record[key] = parseFloat((Number(record[key] || 0) - Number(val.decrement)).toFixed(2));
                continue;
            }
            if ('set' in val) {
                record[key] = val.set;
                continue;
            }
        }
        record[key] = val;
    }
    return record;
}

function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// --- Generic Model Builder ---

function buildModel(collectionName, opts = {}) {
    const { pkField = 'id', autoIncrement = true, wrapFields = {}, maxRecords = null } = opts;

    function getCol() { return loadCollection(collectionName); }

    function wrapRecord(record) {
        if (!record) return null;
        const r = { ...record };
        for (const [field, Wrapper] of Object.entries(wrapFields)) {
            if (r[field] !== undefined) r[field] = new Wrapper(r[field]);
        }
        return r;
    }

    return {
        async findUnique({ where, select, include } = {}) {
            const col = getCol();
            const record = col.records.find(r => matchesWhere(r, where));
            if (!record) return null;
            let result = wrapRecord(record);
            if (include) result = applyIncludes(result, include);
            if (select) result = applySelect(result, select);
            return result;
        },

        async findFirst({ where, orderBy, select, include } = {}) {
            const col = getCol();
            let filtered = col.records.filter(r => matchesWhere(r, where));
            filtered = applyOrderBy(filtered, orderBy);
            const record = filtered[0];
            if (!record) return null;
            let result = wrapRecord(record);
            if (include) result = applyIncludes(result, include);
            if (select) result = applySelect(result, select);
            return result;
        },

        async findMany({ where, orderBy, skip, take, select, include } = {}) {
            const col = getCol();
            let filtered = col.records.filter(r => matchesWhere(r, where));
            filtered = applyOrderBy(filtered, orderBy);
            if (skip) filtered = filtered.slice(skip);
            if (take) filtered = filtered.slice(0, take);
            return filtered.map(r => {
                let result = wrapRecord(r);
                if (include) result = applyIncludes(result, include);
                if (select) result = applySelect(result, select);
                return result;
            });
        },

        async create({ data, select } = {}) {
            return withLock(() => {
                const col = getCol();
                const record = { ...data };
                if (autoIncrement && !record[pkField]) {
                    record[pkField] = col.nextId++;
                }
                if (!record.createdAt) record.createdAt = new Date().toISOString();
                col.records.push(record);
                if (maxRecords && col.records.length > maxRecords) {
                    col.records = col.records.slice(-maxRecords);
                }
                saveCollection(collectionName);
                let result = wrapRecord(record);
                if (select) result = applySelect(result, select);
                return result;
            });
        },

        async update({ where, data, select } = {}) {
            return withLock(() => {
                const col = getCol();
                const idx = col.records.findIndex(r => matchesWhere(r, where));
                if (idx === -1) throw new Error(`Record not found in ${collectionName}`);
                applyDataUpdate(col.records[idx], data);
                saveCollection(collectionName);
                let result = wrapRecord(col.records[idx]);
                if (select) result = applySelect(result, select);
                return result;
            });
        },

        async updateMany({ where, data } = {}) {
            return withLock(() => {
                const col = getCol();
                let count = 0;
                col.records.forEach(r => {
                    if (!where || matchesWhere(r, where)) {
                        applyDataUpdate(r, data);
                        count++;
                    }
                });
                if (count > 0) saveCollection(collectionName);
                return { count };
            });
        },

        async upsert({ where, update: updateData, create: createData, select } = {}) {
            return withLock(() => {
                const col = getCol();
                const idx = col.records.findIndex(r => matchesWhere(r, where));
                if (idx !== -1) {
                    applyDataUpdate(col.records[idx], updateData);
                    saveCollection(collectionName);
                    let result = wrapRecord(col.records[idx]);
                    if (select) result = applySelect(result, select);
                    return result;
                } else {
                    const record = { ...createData };
                    if (autoIncrement && !record[pkField]) {
                        record[pkField] = col.nextId++;
                    }
                    if (!record.createdAt) record.createdAt = new Date().toISOString();
                    col.records.push(record);
                    saveCollection(collectionName);
                    let result = wrapRecord(record);
                    if (select) result = applySelect(result, select);
                    return result;
                }
            });
        },

        async delete({ where } = {}) {
            return withLock(() => {
                const col = getCol();
                const idx = col.records.findIndex(r => matchesWhere(r, where));
                if (idx === -1) return null;
                const [removed] = col.records.splice(idx, 1);
                saveCollection(collectionName);
                return wrapRecord(removed);
            });
        },

        async deleteMany({ where } = {}) {
            return withLock(() => {
                const col = getCol();
                const before = col.records.length;
                col.records = col.records.filter(r => !matchesWhere(r, where));
                const count = before - col.records.length;
                if (count > 0) saveCollection(collectionName);
                return { count };
            });
        },

        async count({ where } = {}) {
            const col = getCol();
            if (!where) return col.records.length;
            return col.records.filter(r => matchesWhere(r, where)).length;
        }
    };
}

// --- Include/Relations ---

function applyIncludes(record, include) {
    if (!include || !record) return record;
    const result = { ...record };

    if (include.trades) {
        const tradeCol = loadCollection('trades');
        let trades = tradeCol.records.filter(t => t.userId === record.id);
        if (typeof include.trades === 'object') {
            if (include.trades.orderBy) trades = applyOrderBy(trades, include.trades.orderBy);
            if (include.trades.take) trades = trades.slice(0, include.trades.take);
            if (include.trades.where) trades = trades.filter(t => matchesWhere(t, include.trades.where));
        }
        result.trades = trades;
    }

    if (include.gachas) {
        const gachaCol = loadCollection('gachas');
        let gachas = gachaCol.records.filter(g => g.userId === record.id);
        if (typeof include.gachas === 'object') {
            if (include.gachas.orderBy) gachas = applyOrderBy(gachas, include.gachas.orderBy);
            if (include.gachas.take) gachas = gachas.slice(0, include.gachas.take);
        }
        result.gachas = gachas;
    }

    if (include.images) {
        const imageCol = loadCollection('images');
        result.images = imageCol.records.filter(i => i.uploaderId === record.id);
    }

    if (include.user) {
        const userCol = loadCollection('users');
        const user = userCol.records.find(u => u.id === record.userId);
        if (include.user.select) {
            result.user = user ? applySelect(user, include.user.select) : null;
        } else {
            result.user = user || null;
        }
    }

    return result;
}

// --- Model Instances ---

const user = buildModel('users', { wrapFields: { balance: DecimalValue } });
const setting = buildModel('settings', { pkField: 'key', autoIncrement: false });
const trade = buildModel('trades');
const gacha = buildModel('gachas');
const image = buildModel('images');
const accessLog = buildModel('access-logs', { maxRecords: 500 });

// --- In-Memory Stores ---

const tempRegStore = new Map();
const verCodeStore = new Map();

const tempReg = {
    async findUnique({ where }) {
        const key = where.username || where.id;
        const record = tempRegStore.get(key);
        if (!record) return null;
        if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
            tempRegStore.delete(key);
            return null;
        }
        return { ...record };
    },
    async upsert({ where, update: updateData, create: createData }) {
        const key = where.username;
        if (tempRegStore.has(key)) {
            const record = tempRegStore.get(key);
            Object.assign(record, updateData);
            return { ...record };
        }
        const record = { ...createData };
        tempRegStore.set(key, record);
        return { ...record };
    },
    async update({ where, data }) {
        const key = where.username || where.id;
        const record = tempRegStore.get(key);
        if (!record) throw new Error('TempReg not found');
        Object.assign(record, data);
        return { ...record };
    },
    async delete({ where }) {
        const key = where.username || where.id;
        const record = tempRegStore.get(key);
        tempRegStore.delete(key);
        return record || null;
    }
};

const verificationCode = {
    async findUnique({ where }) {
        const key = where.email || where.id;
        const record = verCodeStore.get(key);
        if (!record) return null;
        return { ...record };
    },
    async upsert({ where, update: updateData, create: createData }) {
        const key = where.email;
        if (verCodeStore.has(key)) {
            const record = verCodeStore.get(key);
            Object.assign(record, updateData);
            return { ...record };
        }
        const record = { ...createData };
        verCodeStore.set(key, record);
        return { ...record };
    },
    async delete({ where }) {
        const key = where.email || where.id;
        const record = verCodeStore.get(key);
        verCodeStore.delete(key);
        return record || null;
    }
};

// --- Transaction ---

async function $transaction(fnOrArray) {
    const snapshot = deepClone(collections);
    try {
        if (typeof fnOrArray === 'function') {
            const result = await fnOrArray(db);
            return result;
        }
        const results = [];
        for (const op of fnOrArray) {
            results.push(await op);
        }
        return results;
    } catch (e) {
        Object.keys(snapshot).forEach(key => {
            collections[key] = snapshot[key];
            saveCollection(key);
        });
        throw e;
    }
}

// --- Export ---

const db = {
    user,
    setting,
    trade,
    gacha,
    image,
    accessLog,
    tempReg,
    verificationCode,
    $transaction
};

module.exports = db;
module.exports.default = db;

