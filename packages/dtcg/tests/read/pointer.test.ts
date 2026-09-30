import { getNodeValue } from "jsonc-parser";
import { describe, expect, it } from "vitest";
import { parseJson } from "../../src/read/json.js";
import { follow, parsePointer } from "../../src/read/pointer.js";

function tree(text: string) {
    const parsed = parseJson("test.json", text);
    if (!parsed.ok) throw new Error("test document is not valid JSON");
    return parsed.file.root;
}

function valueAt(text: string, pointer: string) {
    const steps = parsePointer(pointer);
    if (!steps) return { invalid: true };
    const followed = follow(tree(text), steps);
    return followed.ok
        ? { value: JSON.parse(JSON.stringify(getNodeValue(followed.node))) }
        : { notFound: followed.step };
}

const rfc = String.raw`{
    "foo": ["bar", "baz"],
    "": 0,
    "a/b": 1,
    "c%d": 2,
    "e^f": 3,
    "g|h": 4,
    "i\\j": 5,
    "k\"l": 6,
    " ": 7,
    "m~n": 8
}`;

describe("RFC 6901, section 5: the JSON string form", () => {
    it.for([
        ["", JSON.parse(rfc)],
        ["/foo", ["bar", "baz"]],
        ["/foo/0", "bar"],
        ["/", 0],
        ["/a~1b", 1],
        ["/c%d", 2],
        ["/e^f", 3],
        ["/g|h", 4],
        ["/i\\j", 5],
        ['/k"l', 6],
        ["/ ", 7],
        ["/m~0n", 8],
    ] as const)("%j reaches %j", ([pointer, value]) => {
        expect(valueAt(rfc, pointer)).toStrictEqual({ value });
    });
});

describe("RFC 6901, section 6: the fragment form, read as written", () => {
    it.for([
        ["#", JSON.parse(rfc)],
        ["#/foo", ["bar", "baz"]],
        ["#/foo/0", "bar"],
        ["#/", 0],
        ["#/a~1b", 1],
        ["#/m~0n", 8],
    ] as const)("%j reaches %j", ([pointer, value]) => {
        expect(valueAt(rfc, pointer)).toStrictEqual({ value });
    });

    it.for(["#/c%25d", "#/e%5Ef", "#/g%7Ch", "#/i%5Cj", "#/k%22l", "#/%20"])(
        "does not percent-decode %j, so it finds no key here",
        (pointer) => {
            expect(valueAt(rfc, pointer)).toStrictEqual({ notFound: 0 });
        },
    );

    it("reads a percent sign as part of the name", () => {
        expect(valueAt('{ "c%25d": 1 }', "#/c%25d")).toStrictEqual({ value: 1 });
    });
});

describe("Format 7.4.6: path examples", () => {
    const tokens = `{
        "primary": { "$type": "number", "$value": 1 },
        "colors": { "blue": { "$type": "number", "$value": 2 } },
        "color": { "components": [0.1, 0.2, 0.3] },
        "brand colors": { "primary": { "$type": "number", "$value": 3 } },
        "my/group": { "token": { "$type": "number", "$value": 4 } }
    }`;

    it.for([
        ["#/primary", { $type: "number", $value: 1 }],
        ["#/colors/blue", { $type: "number", $value: 2 }],
        ["#/color/components/0", 0.1],
        ["#/brand colors/primary", { $type: "number", $value: 3 }],
        ["#/my~1group/token", { $type: "number", $value: 4 }],
        ["#/colors/blue/$value", 2],
    ] as const)("%j reaches %j", ([pointer, value]) => {
        expect(valueAt(tokens, pointer)).toStrictEqual({ value });
    });
});

describe("syntax", () => {
    it.for(["foo", "#foo", "/a~2b", "/a~", "#/~x"])("refuses %j", (pointer) => {
        expect(parsePointer(pointer)).toBeUndefined();
    });

    it("unescapes ~01 as ~1, not /", () => {
        expect(parsePointer("/~01")).toStrictEqual(["~1"]);
    });
});

describe("arrays", () => {
    const list = '{ "list": ["a", "b"] }';

    it.for(["-", "2", "01", "+1", "1.0", "a"])("finds nothing at %j", (index) => {
        expect(valueAt(list, `/list/${index}`)).toStrictEqual({ notFound: 1 });
    });
});

describe("following", () => {
    it("reports the step where it stopped", () => {
        expect(valueAt('{ "a": { "b": 1 } }', "/a/c/d")).toStrictEqual({ notFound: 1 });
    });

    it("finds nothing inside a value that is not an object or a list", () => {
        expect(valueAt('{ "a": 1 }', "/a/b")).toStrictEqual({ notFound: 1 });
    });

    it("finds the last of a key written twice, as the rest of the reader does", () => {
        expect(valueAt('{ "a": 1, "a": 2 }', "/a")).toStrictEqual({ value: 2 });
    });

    it("does not reach inherited properties", () => {
        expect(valueAt("{}", "/__proto__")).toStrictEqual({ notFound: 0 });
        expect(valueAt("{}", "/constructor")).toStrictEqual({ notFound: 0 });
    });
});
