export async function runSerializable(prisma, callback, maxAttempts = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await prisma.$transaction(callback, {
                isolationLevel: 'Serializable',
                maxWait: 5000,
                timeout: 15000
            });
        } catch (error) {
            lastError = error;
            if (error?.code !== 'P2034' || attempt === maxAttempts) throw error;
        }
    }

    throw lastError;
}
