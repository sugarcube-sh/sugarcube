import { object, ofType } from "./syntax.js";

export const border = object({
    color: ofType("color"),
    width: ofType("dimension"),
    style: ofType("strokeStyle"),
});
