// The FlowBuddy mark. Source of truth: docs/design_system/assets/logo-mark.png;
// public/logo-mark.png is a 256px copy of it.
export function Logo({ size = 26, className = '' }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static asset, no optimisation needed
    <img
      src="/logo-mark.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className={`inline-block shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
