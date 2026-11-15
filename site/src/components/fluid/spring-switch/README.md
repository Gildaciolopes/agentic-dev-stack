# SpringSwitch

An on and off switch whose thumb stretches as it travels.

## Example

```tsx
import { SpringSwitch } from "./SpringSwitch";

<SpringSwitch label="Email notifications" checked={emails} onChange={setEmails} />
```

## Props

| Prop | Type | Default | What it does |
|---|---|---|---|
| checked | boolean |  |  |
| onChange | (checked) => void |  |  |
| label | string |  | Visible and announced. |
| className | string |  | For layout, like full width in a settings list. |

## Keyboard and screen readers

`role="switch"` with `aria-checked`. Works in high contrast mode.

## Notes

The thumb uses `--fluid-on-accent`, so it stays visible in light and dark themes.

Every colour comes from the `--fluid-*` variables, and the piece is yours to change.
