# LogoWipe, LogoCurtain, useCurtain

A curtain in your colour with your logo, for big screen changes.

## Example

```tsx
import { LogoWipe } from "./LogoWipe";

<LogoWipe logo={logo} view={step}>
  {step === "plan" ? <Plan /> : <Checkout />}
</LogoWipe>
```

## Props

| Prop | Type | Default | What it does |
|---|---|---|---|
| LogoWipe logo | string |  | Your logo path. |
| LogoWipe view | string |  | Change it to play the wipe; the old children stay until covered. |
| LogoWipe fixed | boolean | false | Cover the whole screen instead of the wrapped area. |
| LogoCurtain covered | boolean |  | Controlled curtain, for route changes. |
| useCurtain() | { covered, cover(), uncover() } |  | `await cover()` resolves once the screen is covered. |

## Keyboard and screen readers

Hidden from screen readers. Reduced motion skips it.

## Notes

`LogoWipe` holds the old children, which works for screens inside one component. For routes in Next.js App Router use the curtain:

```tsx
const curtain = useCurtain();
const router = useRouter();
const pathname = usePathname();
useEffect(() => curtain.uncover(), [pathname]);

<a
  href="/projects"
  onClick={async (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || pathname === "/projects") return;
    e.preventDefault();
    await curtain.cover();
    router.push("/projects");
  }}
>
  Projects
</a>
<LogoCurtain logo={logo} covered={curtain.covered} />
```

Every colour comes from the `--fluid-*` variables, and the piece is yours to change.
