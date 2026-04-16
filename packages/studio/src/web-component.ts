/**
 * <sugarcube-studio> web component.
 *
 * Framework-agnostic wrapper that embeds Studio in an iframe docked
 * to the right side of the page. Handles:
 *
 * - Rendering the iframe
 * - Show/hide toggle
 * - Listening for postMessage from the iframe (token updates)
 * - Running the sugarcube pipeline and injecting CSS into the host document
 *
 * Usage:
 *   <sugarcube-studio src="/__studio/"></sugarcube-studio>
 */

const STUDIO_WIDTH = "22rem";

const TEMPLATE = `
<style>
    :host {
        display: block;
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: ${STUDIO_WIDTH};
        z-index: 9999;
    }

    :host([hidden]) {
        display: none;
    }

    iframe {
        width: 100%;
        height: 100%;
        border: none;
        background: #0a0a0a;
    }

    .toggle {
        position: fixed;
        bottom: 16px;
        right: 16px;
        z-index: 10000;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 2px solid #27272a;
        background: #18181b;
        color: #fafafa;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }

    .toggle:hover {
        background: #27272a;
    }

    :host(:not([hidden])) .toggle {
        right: calc(${STUDIO_WIDTH} + 16px);
    }
</style>
<iframe></iframe>
<button class="toggle" title="Toggle Studio">◆</button>
`;

class SugarcubeStudio extends HTMLElement {
    private iframe: HTMLIFrameElement | null = null;
    private styleTag: HTMLStyleElement | null = null;

    static get observedAttributes() {
        return ["src", "hidden"];
    }

    connectedCallback() {
        const shadow = this.attachShadow({ mode: "open" });
        shadow.innerHTML = TEMPLATE;

        this.iframe = shadow.querySelector("iframe");
        const toggle = shadow.querySelector(".toggle");

        // Set iframe src with embedded marker so Studio knows it's
        // inside our web component (not the DevTools dock)
        const src = this.getAttribute("src") ?? "/__studio/";
        const url = new URL(src, window.location.origin);
        url.searchParams.set("mode", "embedded");
        if (this.iframe) {
            this.iframe.src = url.toString();
        }

        // Toggle visibility
        toggle?.addEventListener("click", () => {
            if (this.hasAttribute("hidden")) {
                this.removeAttribute("hidden");
                document.body.style.paddingRight = STUDIO_WIDTH;
            } else {
                this.setAttribute("hidden", "");
                document.body.style.paddingRight = "";
            }
        });

        // Push page content over to make room for the sidebar
        document.body.style.paddingRight = STUDIO_WIDTH;

        // Listen for messages from the iframe
        window.addEventListener("message", this.handleMessage);

        // Create style tag for injecting generated CSS
        this.styleTag = document.createElement("style");
        this.styleTag.setAttribute("data-sugarcube-studio", "");
        document.head.appendChild(this.styleTag);
    }

    disconnectedCallback() {
        window.removeEventListener("message", this.handleMessage);
        document.body.style.paddingRight = "";
        this.styleTag?.remove();
    }

    attributeChangedCallback(name: string, _old: string | null, value: string | null) {
        if (name === "src" && this.iframe) {
            this.iframe.src = value ?? "/__studio/";
        }
    }

    private handleMessage = (event: MessageEvent) => {
        // Only accept messages from our iframe
        if (event.source !== this.iframe?.contentWindow) return;

        const data = event.data;
        if (!data || typeof data !== "object") return;

        switch (data.type) {
            case "studio:ready":
                this.sendSnapshot();
                break;

            case "studio:css-update":
                if (this.styleTag && typeof data.css === "string") {
                    this.styleTag.textContent = data.css;
                }
                break;
        }
    };

    /**
     * Send the token snapshot to the iframe. The snapshot is loaded
     * from the URL specified in the `snapshot` attribute, or defaults
     * to the Vite-served virtual module path.
     */
    private async sendSnapshot() {
        const snapshotURL = this.getAttribute("snapshot") ?? "/.sugarcube/snapshot.json";

        try {
            const res = await fetch(snapshotURL);
            const snapshot = await res.json();

            this.iframe?.contentWindow?.postMessage({ type: "studio:init", snapshot }, "*");
        } catch (err) {
            console.error("[sugarcube-studio] Failed to load snapshot:", err);
        }
    }
}

if (!customElements.get("sugarcube-studio")) {
    customElements.define("sugarcube-studio", SugarcubeStudio);
}

export { SugarcubeStudio };
