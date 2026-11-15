# WordCycle

A word that changes, each one coming out of a blur.

## Example

```tsx
import { WordCycle } from "./WordCycle";

<h1>Made for <WordCycle words={["shops.", "clinics.", "you."]} loop={false} /></h1>
```

## Props

| Prop | Type | Default | What it does |
|---|---|---|---|
| words | string[] |  | Short words. The box takes the width of the longest. |
| every | number | 1.6 | Seconds per word. |
| loop | boolean | true | False stops on the last word. |
| play | boolean | true |  |

## Keyboard and screen readers

Screen readers and reduced motion get the last word only.

## Notes

Words do not wrap, so keep them to one or two words. In the product, prefer `loop={false}`.

Every colour comes from the `--fluid-*` variables, and the piece is yours to change.
