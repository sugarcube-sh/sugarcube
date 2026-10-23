import type { InternalConfig } from "@sugarcube-sh/core/client";
import type { Change } from "@sugarcube-sh/dtcg";
import type { Conflict, Edits } from "@sugarcube-sh/dtcg-edit";
import type { PlainSettings } from "./adapters/plain";
import type { BuildProblem } from "./controllers/adapter";

export type GitSaveSettings = {
    readonly host: "github";
    readonly repository: string;
    readonly branch: string;
    readonly entry: string;
    readonly signIn: string;
    readonly install?: string;
};

/** Settings the host publishes in the handshake for clients to read. */
export type StudioConnectionConfig = {
    gitSave?: GitSaveSettings;
};

type Files = Readonly<Record<string, string>>;

/**
 * What a save gives back. A save to a pull request also gives `files`, the files as they are now
 * where it went, for studio to show; a save to disk doesn't, since the host's next message does.
 */
export type SaveOutcome =
    | {
          written: string[];
          deleted: string[];
          pullRequest?: undefined;
          conflicts?: undefined;
          files?: undefined;
          changedOn?: undefined;
      }
    | {
          pullRequest: PullRequest;
          files: Files;
          written?: undefined;
          conflicts?: undefined;
          changedOn?: undefined;
      }
    | {
          conflicts: Conflict[];
          files?: Files;
          changedOn?: string | undefined;
          written?: undefined;
          pullRequest?: undefined;
      };

export type PullRequest = { readonly number: number; readonly url?: string | undefined };

export type StudioSave = (edits: Edits, changes: readonly Change[]) => Promise<SaveOutcome>;

export type StudioMessage = {
    readonly adapter: SentAdapter;
    readonly entry: string;
    readonly files: Readonly<Record<string, string>>;
};

export type SentAdapter =
    | {
          readonly name: "sugarcube";
          readonly settings: InternalConfig;
          readonly problems: readonly BuildProblem[];
      }
    | {
          readonly name: "plain";
          readonly settings: PlainSettings;
          readonly problems: readonly BuildProblem[];
      };
