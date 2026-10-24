import { Route, Routes } from "react-router";
import { ProtectedRoute } from "../features/auth/components/protected-route";
import { HomePage } from "../pages/home-page";
import { LoginPage } from "../pages/login-page";
import { NotFoundPage } from "../pages/not-found-page";
import { ROUTE_PATHS } from "./constants/route.constants";

export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTE_PATHS.login} element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path={ROUTE_PATHS.home} element={<HomePage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
