import { useId } from "react";
import type { SelectFieldProps } from "../../types/form.types";

export function SelectField({
  label,
  id,
  className = "",
  children,
  ...props
}: SelectFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="text-sm font-medium">
        {label}
      </label>
      <select
        {...props}
        id={fieldId}
        className={`rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-700 focus:ring-1 focus:ring-indigo-700 ${className}`}
      >
        {children}
      </select>
    </div>
  );
}
