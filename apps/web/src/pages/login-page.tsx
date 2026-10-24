import { Navigate } from "react-router";
import { LoginForm } from "../features/auth/components/login-form";
import { useAuth } from "../features/auth/hooks/use-auth";
import { ROUTE_PATHS } from "../routes/constants/route.constants";
import { PageContainer } from "../shared/components/page-container";

export function LoginPage() {
  const { session } = useAuth();
  if (session) return <Navigate to={ROUTE_PATHS.home} replace />;
  return (
    <PageContainer className="items-center">
      <section className="w-full max-w-sm">
        <p className="text-sm font-semibold tracking-widest text-indigo-700">
          SARH Orders Console
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mb-8 mt-3 text-slate-600">
          Use your operations account to continue.
        </p>
        <LoginForm />
      </section>
    </PageContainer>
  );
}
