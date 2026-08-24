import type { ReactNode } from "react";
import { Logo } from "./Logo";

export function Header({ children }: { children?: ReactNode }) {
    return (
        <header className="header repel" data-nowrap>
            <div className="cluster cluster-gap-sm" data-cluster-wrap="nowrap">
                <a href="/" aria-label="Sugarcube">
                    <Logo />
                </a>
            </div>
            {children}
        </header>
    );
}
