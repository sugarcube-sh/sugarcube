export type Result<T, E = string> = { success: true; value: T } | { success: false; error: E };

export function success<T>(value: T): Result<T> {
    return { success: true, value };
}

export function error<T, E = string>(error: E): Result<T, E> {
    return { success: false, error };
}
