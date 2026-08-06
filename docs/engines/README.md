# Reference data on specific engines

A directory for machine-readable data on real engines and their propulsion
installations, on which the model relies. The format is JSON, one product (or
one assembly of a product) per file.

| File | About | Main sources |
|---|---|---|
| [`cfm56-7b-nacelle.json`](cfm56-7b-nacelle.json) | CFM56-7B nacelle (Boeing 737NG): dimensions, composition, installation on the aircraft | Boeing ACAP D6-58325-7, EASA TCDS E.004, NTSB AAR-19/03 |

## Format conventions

Every numeric value is an object, not a bare number:

```json
{ "value": 2.44, "unit": "m", "original": "APPROX 8 FT",
  "source": "boeing_acap_ng_revc", "confidence": "documented" }
```

- `source` — a key from the `sources` section of the same file (title, publisher, date, URL).
- `confidence`:
  - `documented` — the value is printed directly in the source;
  - `derived` — obtained by calculation or measurement; the method is described in `measurement_method`;
  - `derived_low` — the same, but with substantial uncertainty (obscured outlines, schematic drawings).
- `original` — the value in the units of the source (feet/inches/pounds), so that the primary figure is not lost in conversion.
- The `not_published` section lists dimensions that are absent from open sources — so that nobody searches for them twice.

The prototype of the model is the CFM56-7B, see [`../02-geometry.md`](../02-geometry.md) and [`../06-sound.md`](../06-sound.md).
