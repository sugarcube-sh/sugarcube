export const fixTitles = {
    useSimilar: (name: string) => `use \`${name}\`, which has a similar name`,
    deleteEarlier: (key: string) => `delete the earlier \`${key}\`, which is never used`,
    writePointer: (pointer: string) => `write it as \`${pointer}\``,
    deleteType: "delete this `$type`, so the token takes its group's type",
    extendsAsReference: (reference: string) => `write it as the reference \`${reference}\``,
    hexToObject: "write the color as an object, keeping the hex",
    measureAsObject: (type: string) => `write the ${type} as an object`,
    fullHex: (hex: string) =>
        `write the hex with ${hex.length === 9 ? "eight" : "six"} digits, \`${hex}\``,
    referenceAsPointer: (pointer: string) =>
        `write it as the pointer \`${pointer}\`, which can stand for part of a value`,
};
