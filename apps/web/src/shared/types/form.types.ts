import type { ComponentProps } from "react";

export interface TextFieldProps extends ComponentProps<"input"> {
  label: string;
  error?: string;
}

export interface SelectFieldProps extends ComponentProps<"select"> {
  label: string;
}
