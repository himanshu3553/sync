'use client';

import { use, useActionState } from 'react';
import Link from 'next/link';
import { signInAction } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/auth/auth-layout';
import { GoogleButton, OrDivider } from '@/components/auth/social';
import { FieldError } from '@/components/auth/field-error';
import {
  useAuthForm,
  validateEmail,
  validateExistingPassword,
} from '@/components/auth/use-auth-form';

// Post-redirect notices from the auth flows (signup-with-verification, completed reset).
const NOTICES: Record<string, string> = {
  'verify-sent': 'Almost there — we’ve emailed you a verification link. Click it, then sign in.',
  'reset-done': 'Password updated. Sign in with your new password.',
};

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = use(searchParams);
  const [error, action, pending] = useActionState(signInAction, undefined);
  const showResend = Boolean(error?.startsWith('Please verify your email'));
  const form = useAuthForm({ email: validateEmail, password: validateExistingPassword });

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your FlowBuddy workspace"
      footer={
        <>
          Don&rsquo;t have an account?{' '}
          <Link
            href="/signup"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Create one
          </Link>
        </>
      }
    >
      <GoogleButton />
      <OrDivider />
      <Card>
        <form action={action} onSubmit={form.onSubmit} noValidate>
          <CardContent className="space-y-4 pt-6">
            {notice && NOTICES[notice] && (
              <p className="rounded-control border border-success-border bg-success-bg px-3 py-2 text-sm text-success-text2">
                {NOTICES[notice]}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...form.field('email')} />
              <FieldError name="email" message={form.show('email')} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...form.field('password')}
              />
              <FieldError name="password" message={form.show('password')} />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {showResend && (
              <p className="text-sm text-muted-foreground">
                Didn’t get it?{' '}
                <Link
                  href="/verify-email"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Resend the verification email
                </Link>
              </p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={pending || !form.valid}>
              {pending ? 'Signing in…' : 'Sign in'}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              By signing in, you agree to our{' '}
              <Link href="/privacy" className="underline underline-offset-4">
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link href="/terms" className="underline underline-offset-4">
                Terms of Service
              </Link>
              .
            </p>
          </CardFooter>
        </form>
      </Card>
    </AuthLayout>
  );
}
