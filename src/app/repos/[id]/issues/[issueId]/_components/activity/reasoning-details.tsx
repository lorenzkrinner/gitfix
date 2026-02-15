import { ChevronRightIcon } from "@heroicons/react/24/solid";
import { useEffect, useRef, useState } from "react";
import { str, Time } from "../issue-timeline";
import { Shimmer } from "~/components/ai-elements/shimmer";

const REASONING_STREAMING_HEIGHT = 60;

export default function ReasoningDetails({ details, createdAt }: { details: Record<string, unknown>, createdAt: Date }) {
  const [expanded, setExpanded] = useState(details.status === "started");
  const contentRef = useRef<HTMLDivElement>(null);

  const content = str(details.content);
  const status = str(details.status);
  const durationSeconds =
    typeof details.durationSeconds === "number" ? details.durationSeconds : null;
  const isStreaming = status === "started";

  useEffect(() => {
    if (isStreaming) setExpanded(true);
  }, [isStreaming]);

  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  return (
    <div className="w-full flex flex-col">
      <div className="w-full flex justify-between items-center">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors mb-1"
        >
        {isStreaming ? (
          <Shimmer duration={1} className="text-xs">Thinking...</Shimmer>
        ) : (
          <span className="text-xs">
            Thought{durationSeconds !== null ? ` for ${durationSeconds}s` : ""}
          </span>
        )}
          <ChevronRightIcon className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>
        <Time date={createdAt} className="mr-2" />
      </div>
      {expanded && (
        <div
          ref={contentRef}
          className="overflow-y-auto hide-scrollbar relative"
          style={{ maxHeight: REASONING_STREAMING_HEIGHT }}
        >
           <div className="pointer-events-none sticky inset-x-0 top-0 h-4 bg-linear-to-b from-background to-transparent" />
          <p className="text-xs text-muted-foreground/60 pb-1">{content}</p>
          <div className="pointer-events-none sticky inset-x-0 bottom-0 h-4 bg-linear-to-t from-background to-transparent" />
        </div>
      )}
    </div>
  );
}
