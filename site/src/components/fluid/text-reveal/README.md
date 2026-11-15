# TextReveal

A line of text that comes in letter by letter out of a blur.

## Example

```tsx
import { TextReveal } from "./TextReveal";

<h1><TextReveal text="Hello, Ana." /></h1>
```

## Props

| Prop | Type | Default | What it does |
|---|---|---|---|
| text | string |  |  |
| play | boolean | true |  |
| stagger | number | 28 | Milliseconds between letters. |

## Keyboard and screen readers

The whole text is read at once.

Every colour comes from the `--fluid-*` variables, and the piece is yours to change.
