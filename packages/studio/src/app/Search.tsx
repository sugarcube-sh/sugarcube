"use client";

import {
    Command,
    CommandEmpty,
    CommandItem,
    CommandList,
    CommandPrimitive,
} from "../components/ui/command/command";
import { Icon } from "../components/ui/icon/Icons";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useNavigate } from "react-router";
import { createSearch } from "../controllers/search";
import { useStudio } from "../providers/studio-context";
import { toHref } from "./token-path";

function Highlight({ path, query }: { path: string; query: string }) {
    const needle = query.trim();
    const at = path.toLowerCase().indexOf(needle.toLowerCase());
    if (at < 0 || !needle) return <span className="search-path">{path}</span>;

    return (
        <span className="search-path">
            {path.slice(0, at)}
            <b>{path.slice(at, at + needle.length)}</b>
            {path.slice(at + needle.length)}
        </span>
    );
}

export function Search({ onClose }: { onClose: () => void }) {
    const studio = useStudio();
    const search = useMemo(() => createSearch(studio), [studio]);
    const { query, hits, capped } = useSyncExternalStore(search.subscribe, () => search.state);
    const navigate = useNavigate();

    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => inputRef.current?.focus(), []);

    function open(path: string) {
        onClose();
        navigate(toHref(path));
    }

    return (
        <div
            className="search-backdrop"
            onClick={onClose}
            onKeyDown={(event) => event.key === "Escape" && onClose()}
            role="presentation"
        >
            <div
                className="search-panel"
                onClick={(event) => event.stopPropagation()}
                role="presentation"
            >
                <Command shouldFilter={false} loop>
                    <div className="search-field">
                        <Icon name="magnifying-glass" />
                        <CommandPrimitive.Input
                            className="search-input"
                            placeholder="Find a token…"
                            aria-label="Find a token"
                            value={query}
                            ref={inputRef}
                            onValueChange={search.setQuery}
                        />
                        <span className="search-kbd">esc</span>
                    </div>

                    {query.trim() === "" ? (
                        <p className="search-empty">
                            Start typing. Search covers every token in the document.
                        </p>
                    ) : (
                        <>
                            <CommandList className="search-results">
                                <CommandEmpty>Nothing matches “{query.trim()}”.</CommandEmpty>
                                {hits.map((hit) => (
                                    <CommandItem
                                        key={hit.path}
                                        value={hit.path}
                                        className="search-row"
                                        onSelect={() => open(hit.path)}
                                    >
                                        {hit.swatch ? (
                                            <span
                                                className="search-swatch"
                                                style={{ background: hit.swatch }}
                                            />
                                        ) : (
                                            <span className="search-glyph">#</span>
                                        )}
                                        <Highlight path={hit.path} query={query} />
                                        <span className="search-value">{hit.value}</span>
                                    </CommandItem>
                                ))}
                            </CommandList>

                            {hits.length > 0 && (
                                <div className="search-foot">
                                    <span>
                                        {hits.length}
                                        {capped ? "+" : ""} match{hits.length === 1 ? "" : "es"}
                                    </span>
                                    <span>↑↓ to move, ↵ to open</span>
                                </div>
                            )}
                        </>
                    )}
                </Command>
            </div>
        </div>
    );
}
