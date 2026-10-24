import { Navigate, Outlet } from "react-router";
import { ROUTE_PATHS } from "../../../routes/constants/route.constants";
import { useAuth } from "../hooks/use-auth";

export function ProtectedRoute() {
  const { session } = useAuth();
  return session ? <Outlet /> : <Navigate to={ROUTE_PATHS.login} replace />;
}
