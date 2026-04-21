import { execa } from "execa";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLIError } from "../src/cli-error.js";
import { ERROR_MESSAGES } from "../src/constants/error-messages.js";
import { installDependencies } from "../src/installation/dependencies.js";

vi.mock("execa", () => ({
    execa: vi.fn(),
}));

const mockedExeca = vi.mocked(execa);

describe("installDependencies error surfacing", () => {
    beforeEach(() => {
        mockedExeca.mockReset();
    });

    it("appends package-manager stderr to the generic failure message", async () => {
        const stderr = "ERR_PNPM_UNTRUSTED_PACKAGE Package chokidar@4.0.3 has no provenance";
        const execaError = Object.assign(new Error("Command failed"), {
            stderr,
            shortMessage: "Command failed with exit code 1",
        });
        mockedExeca.mockRejectedValueOnce(execaError);

        const thrown = await captureError(() =>
            installDependencies(["chokidar"], "/tmp/test", "pnpm")
        );

        expect(thrown).toBeInstanceOf(CLIError);
        expect((thrown as CLIError).message).toBe(
            ERROR_MESSAGES.DEPENDENCY_INSTALL_FAILED("pnpm", stderr)
        );
        expect((thrown as CLIError).cause).toBe(execaError);
    });

    it("falls back to error.message when stderr is empty", async () => {
        const execaError = Object.assign(new Error("spawn pnpm ENOENT"), {
            stderr: "",
        });
        mockedExeca.mockRejectedValueOnce(execaError);

        const thrown = await captureError(() =>
            installDependencies(["anything"], "/tmp/test", "pnpm")
        );

        expect((thrown as CLIError).message).toBe(
            ERROR_MESSAGES.DEPENDENCY_INSTALL_FAILED("pnpm", "spawn pnpm ENOENT")
        );
    });

    it("returns the plain generic message when the error carries no usable text", async () => {
        const execaError = Object.assign(new Error(""), { stderr: "   " });
        mockedExeca.mockRejectedValueOnce(execaError);

        const thrown = await captureError(() =>
            installDependencies(["anything"], "/tmp/test", "pnpm")
        );

        expect((thrown as CLIError).message).toBe(ERROR_MESSAGES.DEPENDENCY_INSTALL_FAILED("pnpm"));
    });

    it("skips the install when dependency list is empty", async () => {
        await installDependencies([], "/tmp/test", "pnpm");
        expect(mockedExeca).not.toHaveBeenCalled();
    });
});

async function captureError(fn: () => Promise<unknown>): Promise<unknown> {
    try {
        await fn();
    } catch (error) {
        return error;
    }
    throw new Error("expected fn to throw");
}
