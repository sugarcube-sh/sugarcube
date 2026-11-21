import type { ApiDoc, ApiMember, ApiParam, ApiSignature, ApiSymbol } from "./extract.ts";
import type { PlacedPage } from "./pages.ts";

export const BANNER =
    "{/* Written by scripts/api-docs from the doc comments in packages/dtcg/src. Edit those, not this page. */}";

const BASE = "/dtcg/docs/reference";
const LINK = /\{@link(?:code|plain)?\s([^}]*)\}/g;
const TYPE_NAME = /"[^"]*"|'[^']*'|\b[A-Z][\w$]*/g;
const LIST_ITEM = /^\s*[-*] /;
const WRAPPERS = new Set([
    "Array",
    "Awaited",
    "Exclude",
    "Extract",
    "Iterable",
    "Map",
    "NonNullable",
    "Omit",
    "Partial",
    "Pick",
    "Promise",
    "Readonly",
    "ReadonlyArray",
    "ReadonlyMap",
    "ReadonlySet",
    "Record",
    "Required",
    "Set",
]);

export interface Links {
    symbols: Map<string, string>;
    members: Map<string, string>;
}

export function buildLinks(pages: readonly PlacedPage[]): Links {
    const symbols = new Map<string, string>();
    const members = new Map<string, string>();
    for (const page of pages) {
        const url = `${BASE}/${page.config.slug}/`;
        if (page.config.entry) symbols.set(page.config.entry, url);
        if (page.object) {
            symbols.set(page.object.name, url);
            for (const member of page.object.members)
                members.set(`${page.object.name}.${member.name}`, `${url}#${slugOf(member.name)}`);
        }
        for (const section of page.sections) {
            for (const symbol of section.symbols) {
                if (!symbols.has(symbol.name))
                    symbols.set(symbol.name, `${url}#${slugOf(symbol.name)}`);
                if (symbol.kind === "variable")
                    for (const member of symbol.members)
                        members.set(
                            `${symbol.name}.${member.name}`,
                            `${url}#${slugOf(`${symbol.name}.${member.name}`)}`,
                        );
            }
        }
    }
    return { symbols, members };
}

export function renderPage(page: PlacedPage, order: number, links: Links): string {
    const { config } = page;
    const out: string[] = [
        "---",
        `title: ${JSON.stringify(config.title)}`,
        `description: ${JSON.stringify(describePage(page))}`,
        "sidebar:",
        `  order: ${order}`,
        "---",
        "",
        'import Table from "@/src/components/Table.astro";',
        "",
        BANNER,
        "",
        ...(config.intro ? [prose(config.intro, links), ""] : []),
    ];
    if (page.object) out.push(...renderObject(page.object, links));
    for (const section of page.sections) {
        out.push(`## ${section.title}`, "");
        for (const symbol of section.symbols) out.push(...renderSymbol(symbol, links), "");
    }
    return `${out
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()}\n`;
}

function renderSymbol(symbol: ApiSymbol, links: Links): string[] {
    if (symbol.kind === "function")
        return renderCallable(
            `${symbol.name}()`,
            symbol.name,
            symbol,
            symbol.signatures,
            "###",
            links,
        );
    const out = [
        `### \`${symbol.name}\``,
        "",
        ...renderDefinition(symbol, links),
        ...renderDoc(symbol, links),
    ];
    if (symbol.extendsTypes.length) {
        out.push(
            `**Extends:** ${symbol.extendsTypes.map((each) => typeCode(each, links)).join(", ")}`,
            "",
        );
    }
    if (symbol.kind === "type") return [...out, ...renderAliasParts(symbol, links)];
    if (symbol.kind !== "variable") {
        if (symbol.members.length)
            out.push(...renderMemberTable(symbol.name, symbol.members, links));
        return out;
    }
    const prefix = `${symbol.name}.`;
    for (const method of symbol.members.filter((member) => member.kind === "method")) {
        out.push(
            ...renderCallable(
                `${prefix}${method.name}()`,
                `${prefix}${method.name}`,
                method,
                method.signatures,
                "####",
                links,
            ),
            "",
        );
    }
    return out;
}

export function describePage(page: PlacedPage): string {
    const description = page.object
        ? splitSummary(page.object.description).summary
        : page.config.description!;
    return description.replace(LINK, (_match, inside: string) => {
        const { target, label } = splitLink(inside.trim());
        return label ?? target;
    });
}

function splitSummary(text: string): { summary: string; rest: string } {
    const [summary = "", ...rest] = text.split(/\n\s*\n/);
    return { summary: summary.replace(/\s+/g, " ").trim(), rest: rest.join("\n\n") };
}

function renderObject(object: ApiSymbol, links: Links): string[] {
    const out = [
        "```ts",
        `import type { ${object.name} } from "${object.entry}";`,
        "```",
        "",
        ...renderDoc({ ...object, description: splitSummary(object.description).rest }, links),
    ];
    const properties = object.members.filter((member) => member.kind === "property");
    const methods = object.members.filter((member) => member.kind === "method");
    if (properties.length) out.push("## Properties", "");
    for (const property of properties) {
        out.push(
            `### \`${property.name}\``,
            "",
            ...renderDoc(property, links),
            `**Type:** ${typeCode(`${property.type}${property.optional ? " | undefined" : ""}`, links)}`,
            "",
        );
    }
    if (methods.length) out.push("## Methods", "");
    for (const method of methods) {
        out.push(
            ...renderCallable(
                `${method.name}()`,
                method.name,
                method,
                method.signatures,
                "###",
                links,
            ),
            "",
        );
    }
    return out;
}

function isLiteralUnion(symbol: ApiSymbol): boolean {
    return Boolean(
        symbol.variants?.every((each) => /^(?:"[^"]*"|'[^']*'|-?\d+|true|false)$/.test(each)),
    );
}

function renderDefinition(symbol: ApiSymbol, links: Links): string[] {
    if (symbol.kind === "variable" && symbol.type)
        return ["```ts", `const ${symbol.name}: ${symbol.type}`, "```", ""];
    if (symbol.kind !== "type" || isLiteralUnion(symbol) || symbol.members.length) return [];
    return [
        "```ts",
        `type ${symbol.name}${symbol.typeParameters ?? ""} = ${symbol.type!.replace(/^\|\s*/, "")}`,
        "```",
        "",
        ...typeLinks(symbol.type!, links),
    ];
}

function renderAliasParts(symbol: ApiSymbol, links: Links): string[] {
    if (isLiteralUnion(symbol))
        return [`**One of:** ${symbol.variants!.map((each) => `\`${each}\``).join(", ")}`, ""];
    if (symbol.members.length) return renderMemberTable(symbol.name, symbol.members, links);
    return [];
}

function documentedNames(type: string, links: Links): string[] {
    const names = (type.match(TYPE_NAME) ?? []).filter(
        (name) => !WRAPPERS.has(name) && links.symbols.has(name),
    );
    return [...new Set(names)];
}

function typeLinks(type: string, links: Links): string[] {
    const names = documentedNames(type, links);
    if (!names.length) return [];
    return [
        `**Uses:** ${names.map((name) => `[\`${name}\`](${links.symbols.get(name)})`).join(", ")}`,
        "",
    ];
}

function renderCallable(
    heading: string,
    call: string,
    doc: ApiDoc,
    signatures: readonly ApiSignature[],
    level: string,
    links: Links,
): string[] {
    const out = [`${level} \`${heading}\``, ""];
    const eachFormDocumented = signatures.length > 1 && signatures.some((each) => each.doc);
    if (eachFormDocumented) {
        signatures.forEach((signature, index) => {
            out.push(
                `**Form ${index + 1} of ${signatures.length}**`,
                "",
                "```ts",
                signatureLine(call, signature),
                "```",
                "",
                ...renderDoc(signature.doc ?? doc, links, { omitThrows: true }),
                ...renderParamTable(signature.params, links),
                returnsLine(signature.returns, signature.doc?.returns ?? doc.returns, links),
                "",
            );
        });
    } else {
        out.push(
            "```ts",
            ...signatures.map((signature) => signatureLine(call, signature)),
            "```",
            "",
            ...renderDoc(doc, links, { omitThrows: true }),
        );
        const [only] = signatures;
        if (only && signatures.length === 1) {
            out.push(
                ...renderParamTable(only.params, links),
                returnsLine(only.returns, doc.returns, links),
                "",
            );
        } else {
            out.push(...renderParamDescriptions(signatures[0]?.params ?? [], links));
            if (doc.returns) out.push(`**Returns:** ${prose(doc.returns, links)}`, "");
        }
    }
    const throws = [
        ...doc.throws,
        ...signatures.flatMap((signature) => signature.doc?.throws ?? []),
    ];
    if (throws.length)
        out.push("**Throws:**", "", ...throws.map((each) => `- ${prose(each, links)}`), "");
    return out;
}

function returnsLine(type: string, description: string | undefined, links: Links): string {
    return `**Returns:** ${typeCode(type, links)}${description ? ` ${prose(description, links)}` : ""}`;
}

function renderParamDescriptions(params: readonly ApiParam[], links: Links): string[] {
    if (!params.some((param) => param.description)) return [];
    return [
        "<Table>",
        "| Parameter | Description |",
        "| --- | --- |",
        ...params.map(
            (param) =>
                `| \`${param.name}${param.optional ? "?" : ""}\` | ${cell(prose(param.description, links))} |`,
        ),
        "</Table>",
        "",
    ];
}

function signatureLine(call: string, signature: ApiSignature): string {
    const params = signature.params
        .map((param) => `${param.name}${param.optional ? "?" : ""}: ${param.type}`)
        .join(", ");
    return `${call}${signature.typeParameters ?? ""}(${params}): ${signature.returns}`;
}

function renderDoc(doc: ApiDoc, links: Links, options: { omitThrows?: boolean } = {}): string[] {
    const out: string[] = [];
    if (doc.description) out.push(prose(doc.description, links), "");
    for (const example of doc.examples) out.push(...renderExample(example));
    if (doc.see.length)
        out.push(`**See:** ${doc.see.map((each) => prose(each, links)).join(", ")}`, "");
    if (!options.omitThrows && doc.throws.length)
        out.push("**Throws:**", "", ...doc.throws.map((each) => `- ${prose(each, links)}`), "");
    return out;
}

function renderExample(example: string): string[] {
    const lines = example.split("\n");
    const caption = lines[0]?.startsWith("// ") ? lines.shift()!.slice(3) : undefined;
    return [
        ...(caption ? [`**Example:** ${escapeText(caption)}`, ""] : []),
        "```ts",
        ...lines,
        "```",
        "",
    ];
}

function renderParamTable(params: readonly ApiParam[], links: Links): string[] {
    if (params.length === 0) return [];
    const described = params.some((param) => param.description);
    const header = described
        ? ["| Parameter | Type | Description |", "| --- | --- | --- |"]
        : ["| Parameter | Type |", "| --- | --- |"];
    const rows = params.map((param) => {
        const cells = [
            `\`${param.name}${param.optional ? "?" : ""}\``,
            cell(typeCode(param.type, links)),
        ];
        if (described) cells.push(cell(prose(param.description, links)));
        return `| ${cells.join(" | ")} |`;
    });
    return ["<Table>", ...header, ...rows, "</Table>", ""];
}

function renderMemberTable(owner: string, members: readonly ApiMember[], links: Links): string[] {
    const rows = members.map((member) => {
        const method = member.kind === "method";
        const description = [
            member.description && prose(member.description, links),
            member.defaultValue && `Default: \`${member.defaultValue}\``,
            member.inheritedFrom && `Inherited from ${typeCode(member.inheritedFrom, links)}.`,
        ]
            .filter(Boolean)
            .join(" ");
        const type = method
            ? member.signatures
                  .map((signature) => cell(typeCode(arrowType(signature), links)))
                  .join("<br />")
            : cell(typeCode(member.type, links));
        return `| \`${member.name}${method ? "()" : ""}${member.optional ? "?" : ""}\` | ${type} | ${cell(description)} |`;
    });
    const table = (label: string, kind: ApiMember["kind"]) => {
        const kept = rows.filter((_row, index) => members[index]!.kind === kind);
        if (kept.length === 0) return [];
        return [
            "<Table>",
            `| ${label} | Type | Description |`,
            "| --- | --- | --- |",
            ...kept,
            "</Table>",
            "",
        ];
    };
    return [
        ...table("Property", "property"),
        ...table("Method", "method"),
        ...members.flatMap((member) => renderMemberDetails(owner, member, links)),
    ];
}

function renderMemberDetails(owner: string, member: ApiMember, links: Links): string[] {
    const out: string[] = [];
    const several = member.signatures.length > 1;
    member.signatures.forEach((signature, index) => {
        const details: string[] = [];
        if (signature.doc?.description) details.push(prose(signature.doc.description, links), "");
        if (signature.params.some((param) => param.description))
            details.push(...renderParamTable(signature.params, links));
        const returned = signature.doc?.returns;
        if (returned) details.push(`**Returns:** ${prose(returned, links)}`, "");
        for (const example of signature.doc?.examples ?? [])
            details.push(...renderExample(example));
        if (details.length && several)
            out.push(`**Form ${index + 1} of ${member.signatures.length}**`, "");
        out.push(...details);
    });
    if (member.returns) out.push(`**Returns:** ${prose(member.returns, links)}`, "");
    const throws = [
        ...member.throws,
        ...member.signatures.flatMap((signature) => signature.doc?.throws ?? []),
    ];
    if (throws.length)
        out.push("**Throws:**", "", ...throws.map((each) => `- ${prose(each, links)}`), "");
    for (const example of member.examples) out.push(...renderExample(example));
    if (member.see.length)
        out.push(`**See:** ${member.see.map((each) => prose(each, links)).join(", ")}`, "");
    if (!out.length) return [];
    const name = `${owner}.${member.name}${member.kind === "method" ? "()" : ""}`;
    return [`**\`${name}\`**`, "", ...out];
}

function arrowType(signature: ApiSignature): string {
    const params = signature.params
        .map((param) => `${param.name}${param.optional ? "?" : ""}: ${param.type}`)
        .join(", ");
    return `${signature.typeParameters ?? ""}(${params}) => ${signature.returns}`;
}

function typeCode(type: string, links: Links): string {
    const code = `\`${type}\``;
    const names = documentedNames(type, links);
    if (names.length !== 1) return code;
    const [name] = names as [string];
    const rest = type
        .replace(new RegExp(`\\b${name}\\b`, "g"), "")
        .replace(/\b(?:readonly|undefined|null|string|number|boolean)\b/g, "")
        .replace(/\b[A-Z][\w$]*\b/g, (word) => (WRAPPERS.has(word) ? "" : word));
    const wrapsOneName = /^[\s[\]|<>(),]*$/.test(rest);
    return wrapsOneName ? `[${code}](${links.symbols.get(name)})` : code;
}

function cell(text: string): string {
    const paragraphs = text.split(/\n\s*\n/).map((paragraph) => {
        const lines: string[] = [];
        for (const line of paragraph.split("\n")) {
            if (!lines.length || LIST_ITEM.test(line)) lines.push(line.trim());
            else lines[lines.length - 1] += ` ${line.trim()}`;
        }
        return lines.join("<br />");
    });
    return paragraphs.join("<br /><br />").replace(/\|/g, "\\|");
}

export function prose(text: string, links: Links): string {
    const linked = text.replace(LINK, (_match, inside: string) => {
        const { target, label } = splitLink(inside.trim());
        if (target.startsWith("http://") || target.startsWith("https://"))
            return `[${escapeText(label ?? target)}](${target})`;
        const [name, member] = target.split(".");
        const href = links.symbols.get(name!);
        const shown = label ? escapeText(label) : `\`${target}\``;
        if (!href) return label ? escapeText(label) : `\`${target}\``;
        const anchor = (member && links.members.get(target)) || href;
        return `[${shown}](${anchor})`;
    });
    return escapeOutsideCode(linked);
}

function splitLink(inside: string): { target: string; label?: string } {
    const pipe = inside.indexOf("|");
    if (pipe !== -1)
        return { target: inside.slice(0, pipe).trim(), label: inside.slice(pipe + 1).trim() };
    const space = inside.search(/\s/);
    if (space === -1) return { target: inside };
    return { target: inside.slice(0, space), label: inside.slice(space + 1).trim() };
}

function escapeOutsideCode(text: string): string {
    let out = "";
    let index = 0;
    while (index < text.length) {
        const char = text[index]!;
        if (char === "`") {
            const end = text.indexOf("`", index + 1);
            if (end !== -1) {
                out += text.slice(index, end + 1);
                index = end + 1;
                continue;
            }
        }
        if (char === "[") {
            const close = text.indexOf("](", index);
            const end = close === -1 ? -1 : text.indexOf(")", close);
            if (end !== -1 && !text.slice(index + 1, close).includes("[")) {
                out += text.slice(index, end + 1);
                index = end + 1;
                continue;
            }
        }
        out += escapeText(char);
        index += 1;
    }
    return out;
}

function escapeText(text: string): string {
    return text.replace(/[{}<>]/g, (char) => `\\${char}`);
}

function slugOf(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
}
