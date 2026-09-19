---
"@sugarcube-sh/core": patch
---

Fix a few DTCG conformance issues. Font weight names are now case-sensitive. A gradient stop position below 0 or above 1 is no longer an error. A transition's delay is properly marked 'required' in the types (brining it into line with what the validator already enforced).
