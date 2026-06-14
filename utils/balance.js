export async function debitBalance(tx, userId, amount) {
    const result = await tx.user.updateMany({
        where: {
            id: userId,
            status: 'active',
            balance: { gte: amount }
        },
        data: { balance: { decrement: amount } }
    });

    if (result.count !== 1) {
        throw new Error('账户余额不足');
    }

    return tx.user.findUnique({
        where: { id: userId },
        select: { balance: true }
    });
}

export async function settleWager(tx, userId, cost, reward) {
    await debitBalance(tx, userId, cost);
    if (reward > 0) {
        return tx.user.update({
            where: { id: userId },
            data: { balance: { increment: reward } },
            select: { balance: true }
        });
    }
    return tx.user.findUnique({
        where: { id: userId },
        select: { balance: true }
    });
}
