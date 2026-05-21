import { cn } from "@/lib/cn";

interface TerminalLine {
  type: "prompt" | "cmd" | "output" | "error" | "ok" | "comment" | "highlight";
  text: string;
}

interface TerminalProps {
  lines: TerminalLine[];
  title?: string;
  className?: string;
}

export function Terminal({ lines, title, className }: TerminalProps) {
  return (
    <div className={cn("terminal-block", className)}>
      {title && (
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--color-border-default)]">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-800 opacity-70" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-800 opacity-70" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-800 opacity-70" />
          </div>
          <span className="text-[10px] text-[var(--color-text-muted)] font-mono tracking-widest uppercase ml-2">{title}</span>
        </div>
      )}
      <pre className="whitespace-pre-wrap">
        {lines.map((line, i) => (
          <span key={i} className={lineClass(line.type)}>
            {line.text}{"\n"}
          </span>
        ))}
      </pre>
    </div>
  );
}

function lineClass(type: TerminalLine["type"]): string {
  switch (type) {
    case "prompt":    return "term-prompt";
    case "cmd":       return "term-cmd";
    case "output":    return "term-output";
    case "error":     return "term-error";
    case "ok":        return "term-ok";
    case "comment":   return "text-[var(--color-text-muted)] italic";
    case "highlight": return "term-hadr";
    default:          return "term-output";
  }
}

/** Convenience: render a single command + its simulated output */
export function CommandBlock({ command, output, label }: { command: string; output?: string; label?: string }) {
  const lines: TerminalLine[] = [
    { type: "prompt", text: "$ " },
    { type: "cmd", text: command },
  ];
  if (output) lines.push({ type: "output", text: output });

  return <Terminal lines={lines} title={label} />;
}
