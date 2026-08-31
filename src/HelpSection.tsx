import type { ReactNode } from "react";

export default function HelpSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="help-section">
      <summary><h3>{title}</h3></summary>
      <div className="help-section-copy">{children}</div>
    </details>
  );
}
