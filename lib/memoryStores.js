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

module.exports = { tempReg, verificationCode, tempRegStore, verCodeStore };
