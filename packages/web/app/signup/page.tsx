import { googleEnabled } from '@/auth';
import { SignUpForm } from './signup-form';

export default function SignUpPage() {
  return <SignUpForm googleEnabled={googleEnabled} />;
}
