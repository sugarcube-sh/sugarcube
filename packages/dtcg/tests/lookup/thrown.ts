export function thrownBy<E extends Error>(
    ErrorClass: new (...args: never[]) => E,
    run: () => unknown,
): E {
    try {
        run();
    } catch (error) {
        if (error instanceof ErrorClass) return error;
        throw error;
    }
    throw new Error(`expected a ${ErrorClass.name}`);
}
