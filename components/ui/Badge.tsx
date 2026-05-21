import { cn } from "@/lib/cn";

const categoryColors: Record<string, string> = {
  architecture: "bg-blue-950 text-blue-300 border-blue-800",
  memory:       "bg-teal-950 text-teal-300 border-teal-800",
  logging:      "bg-amber-950 text-amber-300 border-amber-800",
  hadr:         "bg-purple-950 text-purple-300 border-purple-800",
  performance:  "bg-green-950 text-green-300 border-green-800",
  monitoring:   "bg-slate-800 text-slate-300 border-slate-600",
  locking:      "bg-red-950 text-red-300 border-red-800",
  admin:        "bg-zinc-800 text-zinc-300 border-zinc-600",
};

const severityColors: Record<string, string> = {
  critical: "bg-red-950 text-red-300 border-red-800",
  high:     "bg-orange-950 text-orange-300 border-orange-800",
  medium:   "bg-yellow-950 text-yellow-300 border-yellow-800",
  low:      "bg-slate-800 text-slate-300 border-slate-600",
};

interface BadgeProps {
  label: string;
  variant?: "category" | "severity" | "neutral" | "success";
  size?: "sm" | "md";
  className?: string;
}

export function Badge({ label, variant = "neutral", size = "sm", className }: BadgeProps) {
  const colorClass =
    variant === "category" ? (categoryColors[label.toLowerCase()] ?? "bg-slate-800 text-slate-300 border-slate-600") :
    variant === "severity" ? (severityColors[label.toLowerCase()] ?? "bg-slate-800 text-slate-300 border-slate-600") :
    variant === "success" ? "bg-green-950 text-green-300 border-green-800" :
    "bg-slate-800 text-slate-300 border-slate-600";

  return (
    <span className={cn(
      "inline-flex items-center border rounded font-mono font-medium uppercase tracking-wider",
      size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1",
      colorClass,
      className
    )}>
      {label}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  const labels: Record<string, string> = {
    architecture: "Architecture",
    memory:       "Memory",
    logging:      "Logging",
    hadr:         "HADR",
    performance:  "Performance",
    monitoring:   "Monitoring",
    locking:      "Locking",
    admin:        "Admin",
  };
  return <Badge label={labels[category] ?? category} variant="category" />;
}
