import { ChevronRightIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import { str } from "../issue-timeline";

export default function ReasoningDetails({ details }: { details: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);

  const content = str(details.content);
  const status = str(details.status);
  const durationSeconds =
    typeof details.durationSeconds === "number" ? details.durationSeconds : null;
  const isCompleted = status === "completed";

  if (isCompleted && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
      >
        <span className="text-xs">
          Thought{durationSeconds !== null ? ` for ${durationSeconds}s` : ""}
        </span>
        <ChevronRightIcon className="h-3.5 w-3.5 transition-transform" />
      </button>
    );
  }

  if (isCompleted && expanded) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors mb-1"
        >
          <span className="text-xs">
            Thought{durationSeconds !== null ? ` for ${durationSeconds}s` : ""}
          </span>
          <ChevronRightIcon className="h-3.5 w-3.5 rotate-90 transition-transform" />
        </button>
        <p className="text-xs text-muted-foreground/80 pb-1">{content}</p>
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      {content}
    </p>
  );
}
