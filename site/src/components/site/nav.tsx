"use client";

import { springs } from "@usefluid/motion";
import { useReducedMotion, useSpring } from "@usefluid/motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "@/i18n/navigation";
import { site } from "@/lib/site";
import { btnPrimary } from "./button-styles";
import { GithubIcon, LogoMark } from "./icons";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeSwitch } from "./theme-switch";
import { TransitionLink } from "./transition-link";

const links = [
  { key: "docs", href: "/docs" },
  { key: "architecture", href: "/architecture" },
  { key: "changelog", href: "/changelog" },
] as const;

const linkClass =
  "inline-flex min-h-11 items-center px-3 text-sm text-foreground/80 transition-colors hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8";

export function Nav() {
  const t = useTranslations("shell.nav");
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const header = useRef<HTMLElement>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [scrolledDown, setScrolledDown] = useState(false);
  const [focused, setFocused] = useState(false);

  // Hide on scroll down, show on scroll up.
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - last;
      if (Math.abs(delta) < 6) return;
      setScrolledDown(delta > 0 && y > 120);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const hidden = !reduced && scrolledDown && !open && !focused;
  useSpring(
    { y: hidden ? -110 : 0 },
    ({ y }) => {
      if (header.current) header.current.style.translate = `0 ${y}px`;
    },
    { ...springs.snappy, immediate: reduced },
  );

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const close = () => setOpen(false);

  const github = (
    <a
      href={site.repo}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("githubAria")}
      className="inline-flex size-11 items-center justify-center text-foreground/80 transition-colors hover:text-foreground"
    >
      <GithubIcon />
    </a>
  );

  return (
    <header
      ref={header}
      className="pointer-events-none fixed inset-x-0 top-3 z-50 px-[var(--gutter)]"
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
    >
      <nav
        aria-label={t("label")}
        className="pointer-events-auto mx-auto max-w-[1100px] border border-border bg-card/80 backdrop-blur-md backdrop-saturate-150"
      >
        <div className="flex h-[var(--nav-h)] items-center justify-between gap-3 pl-4 pr-2">
          <TransitionLink href="/" aria-label={t("home")} className="flex min-h-11 items-center gap-2.5 font-bold" onClick={close}>
            <LogoMark size={28} />
            <span className="text-sm">{site.name}</span>
          </TransitionLink>

          <ul className="hidden items-center min-[900px]:flex">
            {links.map((l) => (
              <li key={l.key}>
                <TransitionLink href={l.href} className={linkClass} aria-current={isActive(l.href) ? "page" : undefined}>
                  {t(l.key)}
                </TransitionLink>
              </li>
            ))}
            <li>
              <a href={site.repo} target="_blank" rel="noopener noreferrer" className={linkClass}>
                {t("github")}
              </a>
            </li>
          </ul>

          <div className="hidden items-center gap-2 min-[900px]:flex">
            <LocaleSwitcher />
            <ThemeSwitch />
            {github}
            <TransitionLink href="/docs/02-installation" className={btnPrimary}>
              {t("getStarted")}
            </TransitionLink>
          </div>

          <button
            type="button"
            className="inline-flex size-11 items-center justify-center border-2 border-foreground text-foreground min-[900px]:hidden"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? t("menuClose") : t("menuOpen")}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden focusable="false">
              {open ? <path d="M5 5l14 14M19 5L5 19" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>

        <div id={panelId} hidden={!open} className="border-t border-border p-4 min-[900px]:hidden">
          {open && (
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                <TransitionLink
                  key={l.key}
                  href={l.href}
                  className={`${linkClass} min-h-12`}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  onClick={close}
                >
                  {t(l.key)}
                </TransitionLink>
              ))}
              <a href={site.repo} target="_blank" rel="noopener noreferrer" className={`${linkClass} min-h-12`}>
                {t("github")}
              </a>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <LocaleSwitcher />
                <ThemeSwitch />
              </div>
              <TransitionLink href="/docs/02-installation" className={`${btnPrimary} mt-3`} onClick={close}>
                {t("getStarted")}
              </TransitionLink>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
