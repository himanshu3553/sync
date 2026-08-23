export function FieldError({ name, message }: { name: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={`${name}-error`} className="text-sm text-destructive">
      {message}
    </p>
  );
}
