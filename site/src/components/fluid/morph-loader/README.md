# MorphLoader

A loader that keeps changing shape and ends on a check.

## Example

```tsx
import { MorphLoader } from "./MorphLoader";

<MorphLoader done={!loading} label="Loading orders" doneLabel="Orders loaded" />
```

## Props

| Prop | Type | Default | What it does |
|---|---|---|---|
| done | boolean |  | False while loading; true lands on the check. |
| label | string | "Loading" | Announced while loading. |
| doneLabel | string | "Done" | Announced when done. |

## Keyboard and screen readers

A status region. Reduced motion shows a still shape.

## Notes

It loops only while `done` is false, which is the one honest place for a loop.

Every colour comes from the `--fluid-*` variables, and the piece is yours to change.
