'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { signUpAction } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/auth/auth-layout';
import { GoogleButton, OrDivider } from '@/components/auth/social';
import { FieldError } from '@/components/auth/field-error';
import { useAuthForm, validateEmail, validateNewPassword } from '@/components/auth/use-auth-form';

export default function SignUpPage() {
  const [error, action, pending] = useActionState(signUpAction, undefined);
  const form = useAuthForm({ email: validateEmail, password: validateNewPassword });

  return (
    <AuthLayout
      title="Get started for free"
      subtitle="Create your free account. No credit card required"
      footer={
        <>
          Already have an account?{' '}
          <Link
            href="/signin"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton />
      <OrDivider />
      <Card>
        <form action={action} onSubmit={form.onSubmit} noValidate>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...form.field('email')} />
              <FieldError name="email" message={form.show('email')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...form.field('password')}
              />
              <FieldError name="password" message={form.show('password')} />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={pending || !form.valid}>
              {pending ? 'Creating…' : 'Create account'}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              By signing up, you agree to our{' '}
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
