// Quotes font names if they contain spaces or special characters.
export function quoteFont(font: string): string {
    const genericFonts = [
        "serif",
        "sans-serif",
        "monospace",
        "cursive",
        "fantasy",
        "system-ui",
        "ui-serif",
        "ui-sans-serif",
        "ui-monospace",
        "ui-rounded",
        "emoji",
        "math",
        "fangsong",
    ];

    if (genericFonts.includes(font.toLowerCase())) {
        return font;
    }

    if (/[\s'"!@#$%^&*()=+[\]{};:|\\/,.<>?~]/.test(font)) {
        return `"${font}"`;
    }

    return font;
}
