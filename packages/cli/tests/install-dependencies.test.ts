import { x } from "tinyexec";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLIError } from "../src/cli-error.js";
import { ErrorMessages } from "../src/constants/error-messages.js";
import { installDependencies } from "../src/installation/dependencies.js";

vi.mock("tinyexec", () => ({
    x: vi.fn(),
}));

const mockedRun = vi.mocked(x);

describe("installDependencies error surfacing", () => {
    beforeEach(() => {
        mockedRun.mockReset();
    });

    it("runs the package manager in the target folder, failing when it fails", async () => {
        mockedRun.mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

        await installDependencies(["chokidar"], "/tmp/test", "pnpm", { devDependency: true });

        expect(mockedRun).toHaveBeenCalledWith("pnpm", ["add", "-D", "chokidar"], {
            nodeOptions: { cwd: "/tmp/test" },
            throwOnError: true,
        });
    });

    it("appends package-manager stderr to the generic failure message", async () => {
        const stderr = "ERR_PNPM_UNTRUSTED_PACKAGE Package chokidar@4.0.3 has no provenance";
        const failed = Object.assign(new Error("Command failed"), {
            output: { stdout: "", stderr, exitCode: 1 },
        });
        mockedRun.mockRejectedValueOnce(failed);

        const thrown = await captureError(() =>
            installDependencies(["chokidar"], "/tmp/test", "pnpm"),
        );

        expect(thrown).toBeInstanceOf(CLIError);
        expect((thrown as CLIError).message).toBe(
            ErrorMessages.DEPENDENCY_INSTALL_FAILED("pnpm", stderr),
        );
        expect((thrown as CLIError).cause).toBe(failed);
    });

    it("uses stdout when the package manager writes its error there, as pnpm does", async () => {
        const stdout = "ERR_PNPM_FETCH_404  GET https://registry.npmjs.org/nope: Not Found - 404";
        const failed = Object.assign(new Error("The command exited with a non-zero status (1)"), {
            output: { stdout: ` ${stdout}\n`, stderr: "", exitCode: 1 },
        });
        mockedRun.mockRejectedValueOnce(failed);

        const thrown = await captureError(() => installDependencies(["nope"], "/tmp/test", "pnpm"));

        expect((thrown as CLIError).message).toBe(
            ErrorMessages.DEPENDENCY_INSTALL_FAILED("pnpm", stdout),
        );
    });

    it("falls back to error.message when stderr is empty", async () => {
        mockedRun.mockRejectedValueOnce(new Error("spawn pnpm ENOENT"));

        const thrown = await captureError(() =>
            installDependencies(["anything"], "/tmp/test", "pnpm"),
        );

        expect((thrown as CLIError).message).toBe(
            ErrorMessages.DEPENDENCY_INSTALL_FAILED("pnpm", "spawn pnpm ENOENT"),
        );
    });

    it("returns the plain generic message when the error carries no usable text", async () => {
        const failed = Object.assign(new Error(""), {
            output: { stdout: "", stderr: "   ", exitCode: 1 },
        });
        mockedRun.mockRejectedValueOnce(failed);

        const thrown = await captureError(() =>
            installDependencies(["anything"], "/tmp/test", "pnpm"),
        );

        expect((thrown as CLIError).message).toBe(ErrorMessages.DEPENDENCY_INSTALL_FAILED("pnpm"));
    });

    it("skips the install when dependency list is empty", async () => {
        await installDependencies([], "/tmp/test", "pnpm");
        expect(mockedRun).not.toHaveBeenCalled();
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
