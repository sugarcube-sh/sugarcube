// A form field that checks a color as someone types it, and shows what's wrong.
import { parseColor } from "@sugarcube-sh/dtcg/values";

const result = parseColor(input.value, []);
input.setCustomValidity(result.ok ? "" : (result.errors[0]?.message ?? "Not a colour"));
