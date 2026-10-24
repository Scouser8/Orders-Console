import { Link } from "react-router";
import { ROUTE_PATHS } from "../routes/constants/route.constants";

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 text-slate-600">
        The page you requested does not exist.
      </p>
      <Link
        to={ROUTE_PATHS.home}
        className="mt-6 w-fit font-medium text-indigo-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        Back to home
      </Link>
    </main>
  );
}
