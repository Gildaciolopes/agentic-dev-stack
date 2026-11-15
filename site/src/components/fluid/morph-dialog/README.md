# MorphDialog

A modal window that flows out of the element that opened it and back into it.

## Example

```tsx
import { MorphDialog } from "./MorphDialog";

const [open, setOpen] = useState(false);
const [from, setFrom] = useState<HTMLElement | null>(null);

<button onClick={(e) => { setFrom(e.currentTarget); setOpen(true); }}>Order 2041</button>

<MorphDialog open={open} onClose={() => setOpen(false)} from={from} labelledBy="order-title" className="order-window">
  <h2 id="order-title">Order 2041</h2>
  <button onClick={() => setOpen(false)}>Close</button>
</MorphDialog>
```

## Props

| Prop | Type | Default | What it does |
|---|---|---|---|
| open | boolean |  | Whether the window is open. |
| onClose | () => void |  | Called on Esc and a click outside. Set `open` to false in it. |
| from | HTMLElement \| DOMRect \| null |  | What it grows out of and goes back into. Keep it in its own state and keep it set while closing, so the window flows back home. |
| labelledBy | string |  | Id of the window's title. |
| className, style |  |  | Size and look of the window: width, height, padding, background, radius. |
| contained | boolean | false | Open inside the nearest positioned parent instead of over the page. |

## Keyboard and screen readers

The native `<dialog>`: focus is trapped while open and returns to the opener when it closes. The page behind does not scroll.

## Notes

The shape starts in the colour of `from` and turns into the window's. It closes only when the shape is back home, so do not unmount it in `onClose`; set `open` to false. Override the scrim with `--fluid-scrim`.

Every colour comes from the `--fluid-*` variables, and the piece is yours to change.
