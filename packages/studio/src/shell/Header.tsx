export function Header() {
    return (
        <header className="header">
            <a href="/" aria-label="Sugarcube">
                <svg
                    className="logo"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 148 169"
                    aria-hidden="true"
                    focusable="false"
                    style={{
                        fillRule: "evenodd",
                        clipRule: "evenodd",
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                    }}
                >
                    <path
                        d="m0-80.273-69.518-40.136-69.518 40.136L0 0l-69.518 40.136L-139.036 0"
                        style={{ fill: "none", stroke: "currentColor", strokeWidth: "8px" }}
                        transform="translate(143.036 124.409)"
                    />
                    <path
                        d="M-40.136-40.136h80.272"
                        style={{
                            fill: "none",
                            stroke: "currentColor",
                            strokeWidth: "5px",
                            strokeDasharray: "12,12",
                        }}
                        transform="matrix(0 1 1 0 44.136 84.272)"
                    />
                    <path
                        d="M-40.136-40.136h80.272"
                        style={{
                            fill: "none",
                            stroke: "currentColor",
                            strokeWidth: "5px",
                            strokeDasharray: "12,12",
                        }}
                        transform="matrix(0 1 1 0 183.173 84.272)"
                    />
                    <path
                        d="M-40.136-40.136h80.272"
                        style={{
                            fill: "none",
                            stroke: "currentColor",
                            strokeWidth: "5px",
                            strokeDasharray: "12,12",
                        }}
                        transform="matrix(0 1 1 0 113.654 125.083)"
                    />
                    <path
                        d="m-10.755 40.137 160.546-.001"
                        style={{
                            fill: "none",
                            stroke: "currentColor",
                            strokeWidth: "5px",
                            strokeDasharray: "12,12",
                        }}
                        transform="rotate(150 -3.913 81.368)scale(-1 1)"
                    />
                </svg>
                <span className="visually-hidden">Sugarcube</span>
            </a>
        </header>
    );
}
