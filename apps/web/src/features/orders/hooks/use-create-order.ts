import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../../shared/api/api-error";
import { useAuth } from "../../auth/hooks/use-auth";
import { createOrder } from "../api/create-order";
import { CREATE_ORDER_TIMEOUT_MS } from "../constants/order-create.constants";
import { orderQueryKeys } from "../constants/order.constants";
import type {
  CreateOrderPayload,
  CreateOrderFormProps,
  OrderSubmission,
} from "../types/order-create.types";

export function useCreateOrder(onCreated?: CreateOrderFormProps["onCreated"]) {
  const { session } = useAuth();
  const client = useQueryClient();
  const submissionRef = useRef<OrderSubmission | null>(null);
  const inFlightRef = useRef(false);
  const confirmedRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const [locked, setLocked] = useState(false);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const mutation = useMutation({
    retry: false,
    mutationFn: async (submission: OrderSubmission) => {
      if (!session) throw new Error("Sign in to create an order.");
      const controller = new AbortController();
      controllerRef.current = controller;
      const timeout = window.setTimeout(
        () =>
          controller.abort(
            new DOMException("Request timed out", "TimeoutError"),
          ),
        CREATE_ORDER_TIMEOUT_MS,
      );
      try {
        return await createOrder(
          submission,
          session.accessToken,
          controller.signal,
        );
      } finally {
        window.clearTimeout(timeout);
      }
    },
    onSuccess: (order) => {
      confirmedRef.current = true;
      void client.invalidateQueries({ queryKey: orderQueryKeys.all });
      onCreated?.(order);
    },
    onError: (error) => {
      // Validation rejects the request before persistence, so corrections are safe.
      if (error instanceof ApiError && error.status === 400) {
        setLocked(false);
      }
    },
    onSettled: () => {
      inFlightRef.current = false;
    },
  });
  const canStartNew =
    mutation.isSuccess ||
    (mutation.error instanceof ApiError &&
      [409, 410].includes(mutation.error.status));

  return {
    ...mutation,
    locked,
    canStartNew,
    submit: (payload: CreateOrderPayload) => {
      if (inFlightRef.current || confirmedRef.current) return;
      if (submissionRef.current && !locked) {
        submissionRef.current = { ...submissionRef.current, payload };
      }
      submissionRef.current ??= { key: crypto.randomUUID(), payload };
      inFlightRef.current = true;
      setLocked(true);
      mutation.mutate(submissionRef.current);
    },
    startNew: () => {
      if (!canStartNew || inFlightRef.current) return;
      submissionRef.current = null;
      confirmedRef.current = false;
      setLocked(false);
      mutation.reset();
    },
  };
}
