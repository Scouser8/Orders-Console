import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ApiError } from "../../../shared/api/api-error";
import { Button } from "../../../shared/components/ui/button";
import { TextField } from "../../../shared/components/ui/text-field";
import { useLogin } from "../hooks/use-login";
import { loginSchema } from "../schemas/auth.schema";
import type { LoginCredentials } from "../types/auth.types";

export function LoginForm() {
  const mutation = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  return (
    <form
      noValidate
      onSubmit={handleSubmit((credentials) => mutation.mutate(credentials))}
      className="flex flex-col gap-5"
    >
      <TextField
        label="Email"
        type="email"
        autoComplete="username"
        disabled={mutation.isPending}
        error={errors.email?.message}
        {...register("email")}
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="current-password"
        disabled={mutation.isPending}
        error={errors.password?.message}
        {...register("password")}
      />
      {mutation.isError && (
        <p role="alert" className="text-sm text-red-700">
          {mutation.error instanceof ApiError
            ? mutation.error.message
            : "Unable to sign in. Please try again."}
        </p>
      )}
      <Button
        type="submit"
        disabled={mutation.isPending}
        aria-busy={mutation.isPending}
      >
        {mutation.isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
