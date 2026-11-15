# ShapeMorph

Flows through a route of shapes and lands on your logo.

## Example

```tsx
import { ShapeMorph } from "./ShapeMorph";
import { logo } from "@/lib/logo";

<ShapeMorph logo={logo} label="Acme" />
```

## Props

| Prop | Type | Default | What it does |
|---|---|---|---|
| logo | string |  | Your logo as one path in a 120 x 120 box. Make it with `fluid logo`. |
| route | string[] | circle, flower, square... | The shapes it passes through before the logo. |
| play | boolean | true | Start the route. Pass `false` until it is on screen. |
| label | string |  | Accessible name. Without it the drawing is decorative. |
| className | string |  | Size it from outside: it fills its box. |

## Keyboard and screen readers

With `label` it is an image with that name; without it, it is hidden from screen readers. Reduced motion shows the logo at once.

## Notes

Logos with holes or several parts work. The parts pair up by size, biggest first.

Every colour comes from the `--fluid-*` variables, and the piece is yours to change.
