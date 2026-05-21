import { cn } from "@/lib/cn";
import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", className, children, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center font-medium rounded-lg border cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed";

    const variants = {
      primary:   "bg-blue-700 border-blue-600 text-white hover:bg-blue-600 active:bg-blue-800",
      secondary: "bg-[var(--color-surface-elevated)] border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]",
      ghost:     "bg-transparent border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]",
      danger:    "bg-red-950 border-red-800 text-red-300 hover:bg-red-900",
    };

    const sizes = {
      sm: "text-xs px-2.5 py-1.5 gap-1.5",
      md: "text-sm px-3.5 py-2 gap-2",
      lg: "text-sm px-5 py-2.5 gap-2",
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
