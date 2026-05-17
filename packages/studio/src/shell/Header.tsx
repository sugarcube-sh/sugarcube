import { Logo } from "./Logo";

export function Header() {
    return (
        <header className="header repel">
            <div className="cluster cluster-gap-sm" data-cluster-wrap="nowrap">
                <a href="/" aria-label="Sugarcube">
                    <Logo />
                </a>
                <div className="cluster cluster-gap-3xs font-mono">
                    sc-studio<span className="text-quieter">/</span>
                    <span className="text-quiet">design</span>
                </div>
            </div>
            <div className="dots">
                <div className="dot live" title="connected" />
            </div>
        </header>
    );
}
