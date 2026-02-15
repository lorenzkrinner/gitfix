import { useEffect, useRef, useState } from "react";
import { ChevronRightIcon } from "@heroicons/react/24/solid";
import { Spinner } from "~/components/ui/spinner";
import { Shimmer } from "~/components/ai-elements/shimmer";
import { Markdown } from "~/components/ui/markdown";
import { str, Time } from "../issue-timeline";

const STREAMING_HEIGHT = 80;

export default function WebSearchDetails({
  details,
  createdAt,
}: {
  details: Record<string, unknown>;
  createdAt: Date;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const query = str(details.query);
  const content = str(details.content);
  const status = str(details.status);
  const isStreaming = status === "started";

  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  return (
    <div className="w-full bg-muted rounded-md py-2">
      <div className="w-full flex justify-between items-center px-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors mb-1"
        >
          {isStreaming ? (
            <div className="flex items-center gap-1">
              <Spinner className="size-2 mr-1" />
              <Shimmer duration={1} className="text-xs">{`Searching web... "${query}"`}</Shimmer>
            </div>
          ) : (
            <span className="text-xs">{`Searched web for: "${query}"`}</span>
          )}
          <ChevronRightIcon className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>
        <Time date={createdAt} />
      </div>
      {isStreaming && expanded && (
        <div
          ref={contentRef}
          className="overflow-y-auto hide-scrollbar px-2"
          style={{ maxHeight: STREAMING_HEIGHT }}
        >
          <Markdown className="text-xs text-muted-foreground/80 pt-2 pb-1">{content}</Markdown>
        </div>
      )}
      {!isStreaming && expanded && content && (
        <div className="px-2">
          <Markdown className="text-xs text-muted-foreground/80 pb-1 pt-2">{content}</Markdown>
        </div>
      )}
    </div>
  );
}
