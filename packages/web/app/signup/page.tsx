import { googleEnabled } from '@/auth';
import { SignUpForm } from './signup-form';

// Rendered at REQUEST time, never prerendered: `googleEnabled` reads env vars
// that exist on the running server but NOT inside the Docker image build, so a
// static prerender bakes the Google button OUT. Signin dodged this by accident
// (its `searchParams` make it dynamic); this page has no such input, so it
// must opt in explicitly — the shipped bug was exactly this page static-built
// with googleEnabled=false while signin showed the button.
export const dynamic = 'force-dynamic';

export default function SignUpPage() {
  return <SignUpForm googleEnabled={googleEnabled} />;
}
