import type { ComponentProps } from "react";

export function PageContainer({
  className = "",
  ...props
}: ComponentProps<"main">) {
  return (
    <main
      className={`mx-auto flex min-h-dvh max-w-6xl flex-col justify-center px-6 py-12 ${className}`}
      {...props}
    />
  );
}
