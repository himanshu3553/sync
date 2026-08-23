import { googleEnabled } from '@/auth';
import { SignInForm } from './signin-form';

// Auth.js sends OAuth failures back here as ?error=<code> (pages.error above). Our own signIn
// callback returning false is `AccessDenied`; everything else is a provider/config problem.
const OAUTH_ERRORS: Record<string, string> = {
  AccessDenied: 'We couldn’t sign you in with that Google account.',
  OAuthAccountNotLinked: 'That email is already registered — sign in with your password.',
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { notice, error } = await searchParams;
  const oauthError = error
    ? (OAUTH_ERRORS[error] ?? 'Google sign-in failed. Please try again or use your password.')
    : undefined;
  return <SignInForm googleEnabled={googleEnabled} notice={notice} oauthError={oauthError} />;
}
