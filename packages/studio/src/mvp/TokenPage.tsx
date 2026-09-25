import { useCurrentContext } from "../store/hooks";
import type { Handle } from "../tokens/path-index";
import { NodeHeading } from "./NameInput";
import { ProblemList } from "./Problems";
import { ValueInput } from "./ValueInput";
import {
    type CompositeField,
    compositeFields,
    compositePart,
    emptyLayer,
    layerFields,
    layerNoun,
    readLayers,
    writeCompositeField,
    writeLayers,
} from "./composite";
import { type TokenRow } from "./token-view";
import {
    useBaseContext,
    usePreviewValue,
    useRowWritable,
    useTokenRow,
    useWriteBase,
    useWriteOverride,
} from "./use-group";
import { readField } from "./value-field";

const EMPTY_ROW: TokenRow = { handle: "", path: "", name: "", value: undefined, overrides: [] };

export function TokenPage({ handle }: { handle: Handle }) {
    const row = useTokenRow(handle);
    const writeBase = useWriteBase();
    const writeOverride = useWriteOverride();
    const base = useBaseContext();
    const context = useCurrentContext();
    const writable = useRowWritable(row ?? EMPTY_ROW);
    const parts = compositeFields(row?.type, row?.value);
    const layers = readLayers(row?.type, row?.value);

    if (!row) return null;

    const previewing = context !== base;

    return (
        <article>
            <NodeHeading handle={row.handle} path={row.path} editable={!previewing} />
            {row.description && <p>{row.description}</p>}
            <ProblemList handle={row.handle} />

            {previewing ? (
                <Preview row={row} context={context} />
            ) : !writable ? (
                <p>{readField(row.type, row.value).text}</p>
            ) : layers ? (
                <Layers row={row} layers={layers} onWrite={(next) => writeBase(row, next)} />
            ) : parts.length > 0 ? (
                <table>
                    <thead>
                        <tr>
                            <th scope="col">Part</th>
                            <th scope="col">Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        {parts.map((part) => (
                            <tr key={part.key}>
                                <th scope="row">{part.label}</th>
                                <td>
                                    <ValueInput
                                        type={part.type}
                                        value={compositePart(row.value, part.key)}
                                        label={`${row.path} ${part.label.toLowerCase()}`}
                                        onWrite={(next) =>
                                            writeBase(
                                                row,
                                                writeCompositeField(row.value, part.key, next),
                                            )
                                        }
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                row.value !== undefined && (
                    <ValueInput
                        type={row.type}
                        value={row.value}
                        label={`${row.path} value`}
                        onWrite={(next) => writeBase(row, next)}
                    />
                )
            )}

            {!previewing && row.overrides.length > 0 && (
                <table>
                    <thead>
                        <tr>
                            <th scope="col">Context</th>
                            <th scope="col">Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        {row.overrides.map((override) => (
                            <tr key={override.context}>
                                <th scope="row">{override.context}</th>
                                <td>
                                    <ValueInput
                                        type={row.type}
                                        value={override.value}
                                        label={`${row.path} in ${override.context}`}
                                        onWrite={(next) =>
                                            writeOverride(row, override.context, next)
                                        }
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </article>
    );
}

function Preview({ row, context }: { row: TokenRow; context: string }) {
    const value = usePreviewValue(row.handle, context);
    const field = readField(row.type, value);
    return (
        <p>
            {context}: {field.text || "not declared here"}
        </p>
    );
}

function Layers({
    row,
    layers,
    onWrite,
}: {
    row: TokenRow;
    layers: unknown[];
    onWrite: (next: unknown) => void;
}) {
    const fields = layerFields(row.type);
    const put = (next: unknown[]) => onWrite(writeLayers(row.type as string, row.value, next));

    const move = (from: number, to: number) => {
        if (to < 0 || to >= layers.length) return;
        const next = [...layers];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        put(next);
    };

    return (
        <section>
            {layers.map((layer, index) => (
                <article key={index}>
                    <h2>
                        {layerNoun(row.type, 1)} {index + 1}
                    </h2>
                    <LayerFields
                        fields={fields}
                        layer={layer}
                        label={`${row.path} ${layerNoun(row.type, 1)} ${index + 1}`}
                        onWrite={(next) =>
                            put(layers.map((each, i) => (i === index ? next : each)))
                        }
                    />
                    <button type="button" onClick={() => move(index, index - 1)}>
                        Move up
                    </button>
                    <button type="button" onClick={() => move(index, index + 1)}>
                        Move down
                    </button>
                    <button type="button" onClick={() => put(layers.filter((_, i) => i !== index))}>
                        Remove
                    </button>
                </article>
            ))}

            <button type="button" onClick={() => put([...layers, emptyLayer(row.type as string)])}>
                Add {layerNoun(row.type, 1)}
            </button>
        </section>
    );
}

function LayerFields({
    fields,
    layer,
    label,
    onWrite,
}: {
    fields: CompositeField[];
    layer: unknown;
    label: string;
    onWrite: (next: unknown) => void;
}) {
    return (
        <table>
            <tbody>
                {fields.map((field) => (
                    <tr key={field.key}>
                        <th scope="row">{field.label}</th>
                        <td>
                            <ValueInput
                                type={field.type}
                                value={compositePart(layer, field.key)}
                                label={`${label} ${field.label.toLowerCase()}`}
                                onWrite={(next) =>
                                    onWrite(writeCompositeField(layer, field.key, next))
                                }
                            />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
