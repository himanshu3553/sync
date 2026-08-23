import Link from "next/link";
import { Logo } from "@/components/logo";

// Shared shell for the public legal pages (/privacy, /terms): centred mark + title +
// "last updated" stamp, one card of prose, a back link. Content is the page's own.

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <h2 className="text-[17px] font-extrabold tracking-tight text-ink">
        {title}
      </h2>
      <div className="mt-2 space-y-3 text-[14px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas px-4 py-12">
      <main className="mx-auto w-full max-w-3xl">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo size={36} />
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            {title}
          </h1>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-faint">
            Last updated {lastUpdated}
          </p>
        </div>

        <div className="mt-8 rounded-card border bg-card p-6 shadow-card md:p-8">
          {children}
        </div>

        <div className="mt-6 text-center text-[13px]">
          <Link
            href="/"
            className="text-muted-foreground underline-offset-4 hover:text-ink hover:underline"
          >
            ← Back to FlowBuddy
          </Link>
        </div>
      </main>
    </div>
  );
}
