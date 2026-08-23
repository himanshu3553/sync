'use client';

import { useState } from 'react';

// Inline validation for the auth forms. Mirrors the server's `creds` schema (lib/actions.ts) —
// the server stays the gate; this only tells the user before the round-trip. A field's message
// shows once it has been blurred, or for every field once a submit was attempted.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN = 6;

export function validateEmail(v: string): string | undefined {
  if (!v.trim()) return 'Enter your email.';
  if (!EMAIL_RE.test(v.trim())) return 'Enter a valid email address.';
  return undefined;
}

export function validateNewPassword(v: string): string | undefined {
  if (!v) return 'Enter a password.';
  if (v.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  return undefined;
}

export function validateExistingPassword(v: string): string | undefined {
  return v ? undefined : 'Enter your password.';
}

type Validators<K extends string> = Record<K, (v: string) => string | undefined>;

export function useAuthForm<K extends string>(validators: Validators<K>) {
  const keys = Object.keys(validators) as K[];
  const [values, setValues] = useState<Record<K, string>>(
    () => Object.fromEntries(keys.map((k) => [k, ''])) as Record<K, string>,
  );
  const [touched, setTouched] = useState<Partial<Record<K, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors = Object.fromEntries(keys.map((k) => [k, validators[k](values[k])])) as Partial<
    Record<K, string>
  >;
  const valid = keys.every((k) => !errors[k]);
  const show = (k: K) => ((submitted || touched[k]) && errors[k]) || undefined;

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [e.target.name]: e.target.value }));
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) =>
    setTouched((t) => ({ ...t, [e.target.name]: true }));
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setSubmitted(true);
    if (valid) return;
    e.preventDefault();
    const first = keys.find((k) => errors[k]);
    if (first) (e.currentTarget.elements.namedItem(first) as HTMLInputElement | null)?.focus();
  };

  // Props for an <Input name={k}>: controlled value, handlers, and the a11y error wiring.
  const field = (k: K) => ({
    name: k,
    value: values[k],
    onChange,
    onBlur,
    'aria-invalid': show(k) ? true : undefined,
    'aria-describedby': show(k) ? `${k}-error` : undefined,
    className: show(k) ? 'border-destructive focus-visible:ring-destructive' : undefined,
  });

  return { valid, show, field, onSubmit };
}
