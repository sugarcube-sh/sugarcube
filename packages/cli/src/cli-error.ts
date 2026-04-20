export class CLIError extends Error {
    constructor(message: string, cause?: Error) {
        super(message);
        this.name = "CLIError";
        this.cause = cause;
    }
}
