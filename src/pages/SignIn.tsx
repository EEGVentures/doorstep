import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { AuthForm } from '@/components/AuthForm';

export default function SignIn() {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/';
  if (session) return <Navigate to={next} replace />;
  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-3xl font-bold">Welcome to Doorstep</h1>
      <div className="card p-6"><AuthForm onDone={() => nav(next, { replace: true })} /></div>
    </div>
  );
}
