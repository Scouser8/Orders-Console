import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { login } from "../api/login";
import type { LoginCredentials } from "../types/auth.types";
import { useAuth } from "./use-auth";

export function useLogin() {
  const { signIn } = useAuth();
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => controllerRef.current?.abort(), []);

  return useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const session = await login(credentials, controller.signal);
      controller.signal.throwIfAborted();
      return session;
    },
    onSuccess: signIn,
  });
}
