// A form field that checks a color as someone types it, and shows what's wrong.
import { parseValue } from "@sugarcube-sh/dtcg/values";

const result = parseValue("color", input.value);
input.setCustomValidity(result.ok ? "" : (result.errors[0]?.message ?? "Not a colour"));
