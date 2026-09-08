import { useEffect, useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import "./hymnGroupStack.css";
import { hymnLayout } from "./hymnState";
import type { Hymn } from "./hymnState";

export default function HymnGroupList({
  hymns,
  renderHymn,
}: {
  hymns: Hymn[];
  renderHymn: (hymn: Hymn, index: number) => ReactNode;
}) {
  const instanceId = useId().replaceAll(":", "");
  const layout = useMemo(() => hymnLayout(hymns), [hymns]);
  const hymnIndexes = useMemo(
    () => new Map(hymns.map((hymn, index) => [hymn.id, index])),
    [hymns],
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const availableGroups = new Set(
      layout.filter((item) => item.type === "group").map((item) => item.group.id),
    );
    setExpandedGroups((current) => {
      const next = new Set([...current].filter((id) => availableGroups.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [layout]);

  function toggleGroup(groupId: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  return (
    <div className="hymn-list">
      {layout.map((item, layoutIndex) => {
        if (item.type === "hymn") {
          return renderHymn(item.hymn, hymnIndexes.get(item.hymn.id) || 0);
        }
        const expanded = expandedGroups.has(item.group.id);
        const itemsId = `hymn-group-${instanceId}-${layoutIndex}`;
        return (
          <section
            key={item.group.id}
            className={`hymn-group ${expanded ? "hymn-group-expanded" : "hymn-group-collapsed"}`}
            aria-label={`Grupo ${item.group.name}`}
          >
            <button
              type="button"
              className="hymn-group-deck"
              aria-expanded={expanded}
              aria-controls={itemsId}
              onClick={() => toggleGroup(item.group.id)}
            >
              <span className="hymn-group-deck-copy">
                <strong>{item.group.name}</strong>
              </span>
              <span className="hymn-group-meta">
                <span>{item.hymns.length} {item.hymns.length === 1 ? "hino" : "hinos"}</span>
                <span className="hymn-group-toggle-icon" aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
              </span>
            </button>
            <div
              id={itemsId}
              className={`hymn-group-items ${expanded ? "" : "hymn-group-items-collapsed"}`}
            >
              {item.hymns.map((hymn) => renderHymn(hymn, hymnIndexes.get(hymn.id) || 0))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
