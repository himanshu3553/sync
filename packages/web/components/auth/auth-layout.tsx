import { Bot, Clapperboard, Footprints, MessageSquareText, Video } from 'lucide-react';

// What one recording buys the founder — outcomes, not features. Same copy on sign-up and sign-in.
const OUTCOMES = [
  {
    icon: MessageSquareText,
    title: 'In-app AI assistant',
    body: 'Your users get instant answers inside your product.',
  },
  {
    icon: Footprints,
    title: 'Interactive user onboarding',
    body: 'Step-by-step guidance for easy and fast user onboarding.',
  },
  {
    icon: Clapperboard,
    title: 'Help material, generated',
    body: 'Product help portal with videos and SOPs generated in one click. No manual writing.',
  },
  {
    icon: Bot,
    title: 'Knowledge base for AI agents',
    body: 'A structured, approved product workflows that AI agents can understand and act from.',
  },
];

// The public auth pages' frame: a 60/40 split on desktop — the form on the left, a
// benefits panel on the right (placeholder copy until the real content is written);
// single column below `lg`.
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-canvas">
      <main className="flex w-full items-center justify-center px-4 py-12 lg:w-3/5">
        <div className="w-full max-w-md">
          <div className="mb-10 flex flex-col items-center gap-4 text-center">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          {children}
          <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
        </div>
      </main>
      <aside className="hidden w-2/5 items-center justify-center bg-primary-gradient-logo p-12 text-white lg:flex">
        <div className="max-w-md space-y-8">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              <Video className="size-3.5" aria-hidden="true" />
              Record once
            </span>
            <p className="text-2xl font-semibold leading-snug">
              One recording, Many Benefits.
            </p>
          </div>
          <ul className="space-y-8">
            {OUTCOMES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3.5">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold leading-snug">{title}</p>
                  <p className="text-sm/6 text-white/80">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
