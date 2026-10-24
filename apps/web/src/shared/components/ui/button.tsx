import type { ComponentProps } from "react";

export function Button({
  type = "button",
  className = "",
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={`rounded-md bg-indigo-700 px-4 py-2 font-medium text-white hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
