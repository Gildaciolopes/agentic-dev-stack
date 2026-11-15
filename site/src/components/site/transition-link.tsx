"use client";

import { useReducedMotion } from "@usefluid/motion/react";
import type { ComponentProps, CSSProperties, MouseEvent, ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo } from "react";
import { LogoCurtain, useCurtain } from "@/components/fluid/logo-wipe/LogoWipe";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { logo } from "@/lib/logo";

type Navigate = (href: string) => Promise<void>;
const CurtainContext = createContext<Navigate | null>(null);

/** Gradient curtain: Fluid reads --fluid-accent as a `background`, so a gradient works. */
const curtainVars = { "--fluid-accent": "var(--grad-primary)", "--fluid-on-accent": "#000000" } as CSSProperties;

/** Owns the route-transition curtain. Mount once in the locale layout. */
export function TransitionProvider({ children }: { children: ReactNode }) {
  const curtain = useCurtain();
  const router = useRouter();
  const pathname = usePathname();
  const { uncover } = curtain;

  useEffect(() => uncover(), [pathname, uncover]);
  // Safety net: never leave the screen covered if a navigation fails.
  useEffect(() => {
    if (!curtain.covered) return;
    const t = setTimeout(uncover, 6000);
    return () => clearTimeout(t);
  }, [curtain.covered, uncover]);

  const { cover } = curtain;
  const navigate = useMemo<Navigate>(
    () => async (href) => {
      await cover();
      router.push(href);
    },
    [cover, router],
  );

  return (
    <CurtainContext.Provider value={navigate}>
      {children}
      <div style={curtainVars}>
        <LogoCurtain logo={logo} covered={curtain.covered} />
      </div>
    </CurtainContext.Provider>
  );
}

type Props = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

/** Internal link that plays the Logo Wipe curtain; plain navigation for modifiers, hashes, same path, reduced motion. */
export function TransitionLink({ href, onClick, target, ...rest }: Props) {
  const navigate = useContext(CurtainContext);
  const pathname = usePathname();
  const reduced = useReducedMotion();

  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || !navigate || reduced) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (target && target !== "_self") return;
    if (href.includes("#") || href === pathname) return;
    e.preventDefault();
    void navigate(href);
  };

  return <Link href={href} target={target} onClick={handle} {...rest} />;
}
