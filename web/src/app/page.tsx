import { SiteNav } from "@/components/site/SiteNav";
import { Hero } from "@/components/sections/Hero";
import { LiveDemo } from "@/components/sections/LiveDemo";

/**
 * Page composition shell. The ambient background (mesh + grain) is mounted in
 * layout.tsx beneath everything; this file just stacks the surfaces:
 *
 *   <SiteNav/>  — sticky top nav
 *   <Hero/>     — first surface (id="top")
 *   <LiveDemo/> — second surface (id="demo")
 *
 * Hero and LiveDemo are stubs for now; later stages fill them in.
 */
export default function Page() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <main className="flex-1">
        <Hero />
        <LiveDemo />
      </main>
    </div>
  );
}
