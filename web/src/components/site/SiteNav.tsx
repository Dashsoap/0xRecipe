"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * SiteNav — floating glass island.
 *
 * A pill-shaped, blurred bar that hovers below the top edge (mt-6, w-max,
 * centred). Wordmark on the left, anchor links in the middle, a primary CTA on
 * the right. On <768px the links collapse behind a hamburger that morphs into
 * an X; tapping it drops a full-screen glass overlay with the links staggering
 * in. backdrop-blur is only used on this sticky element (design-system rule).
 */

const SPRING = [0.32, 0.72, 0, 1] as const;

const LINKS = [
  { label: "产品", href: "#top" },
  { label: "原理", href: "#how" },
  { label: "Demo", href: "#demo" },
  { label: "文档", href: "#docs" },
] as const;

export function SiteNav() {
  const reduce = useReducedMotion();
  const [open, setOpen] = React.useState(false);

  // Lock body scroll while the mobile overlay is open.
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header
      aria-label="主导航"
      className="sticky top-0 z-50 w-full px-4 pt-6"
    >
      <nav className="mx-auto flex w-max max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full bg-white/[0.04] p-1.5 pl-5 ring-1 ring-white/10 backdrop-blur-xl">
        {/* Wordmark */}
        <a
          href="#top"
          className="group flex items-center gap-2 pr-1"
          aria-label="0xRecipe 首页"
        >
          <Wordmark />
        </a>

        {/* Desktop links */}
        <div className="ml-2 hidden items-center md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="relative rounded-full px-3.5 py-1.5 text-sm text-white/65 transition-colors duration-500 ease-spring hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="ml-1 hidden md:block">
          <Button size="sm" withArrow>
            开始调用
          </Button>
        </div>

        {/* Mobile hamburger → X */}
        <button
          type="button"
          aria-label={open ? "关闭菜单" : "打开菜单"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.04] ring-1 ring-white/10 transition-colors duration-500 ease-spring hover:bg-white/[0.07] md:hidden"
        >
          <MorphIcon open={open} reduce={!!reduce} />
        </button>
      </nav>

      {/* Mobile full-screen overlay */}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="overlay"
            className="fixed inset-0 z-40 flex flex-col bg-ink-base/80 backdrop-blur-2xl md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: SPRING }}
          >
            <div className="flex flex-1 flex-col justify-center gap-2 px-6 pb-24 pt-28">
              {LINKS.map((link, i) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="border-b border-white/5 py-4 text-3xl font-medium tracking-tight text-white/85"
                  initial={reduce ? false : { opacity: 0, y: 16, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.55, delay: 0.06 + i * 0.06, ease: SPRING }}
                >
                  {link.label}
                </motion.a>
              ))}

              <motion.div
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.55, delay: 0.06 + LINKS.length * 0.06, ease: SPRING }}
                className="mt-6"
              >
                <Button size="lg" withArrow className="w-full" onClick={() => setOpen(false)}>
                  开始调用
                </Button>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

/* ------------------------------------------------------------------------ */

function Wordmark() {
  return (
    <span className="flex items-center gap-2 font-mono text-sm tracking-tight text-white">
      <span
        aria-hidden
        className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan/10 ring-1 ring-cyan/30"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-cyan shadow-glow-cyan" />
      </span>
      <span>
        <span className="text-cyan">0x</span>
        Recipe
      </span>
    </span>
  );
}

/** Hamburger that fluidly morphs into an X on the signature spring curve. */
function MorphIcon({ open, reduce }: { open: boolean; reduce: boolean }) {
  const t = reduce
    ? { duration: 0 }
    : { duration: 0.5, ease: SPRING };
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      aria-hidden
    >
      <motion.line
        x1="4"
        x2="20"
        y1="8"
        y2="8"
        animate={open ? { y1: 12, y2: 12, rotate: 45 } : { y1: 8, y2: 8, rotate: 0 }}
        transition={t}
        style={{ transformOrigin: "center" }}
      />
      <motion.line
        x1="4"
        x2="20"
        y1="16"
        y2="16"
        animate={open ? { y1: 12, y2: 12, rotate: -45 } : { y1: 16, y2: 16, rotate: 0 }}
        transition={t}
        style={{ transformOrigin: "center" }}
      />
    </svg>
  );
}
