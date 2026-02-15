import { useEffect, useRef } from "react";
import { Shimmer } from "~/components/ai-elements/shimmer";
import { str, Time } from "../issue-timeline";

const STREAMING_HEIGHT = 80;

export function FixSummary({
  details,
  createdAt,
}: {
  details: Record<string, unknown>;
  createdAt: Date;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  const content = str(details.content);
  const status = str(details.status);
  const isStreaming = status === "started";

  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  return (
    <div className="flex flex-col gap-0 border-t pt-12 pb-2 mt-6">
      <div className="flex justify-between items-center mb-1">
        {isStreaming ? (
          <Shimmer duration={1} className="text-lg font-medium">Summarizing fix...</Shimmer>
        ) : (
          <span className="text-foreground text-lg font-medium">Fix Summary</span>
        )}
        <Time date={createdAt} className="mr-2" />
      </div>
      <div
        ref={contentRef}
        className={`overflow-y-auto ${isStreaming ? "hide-scrollbar" : ""}`}
        style={isStreaming ? { maxHeight: STREAMING_HEIGHT } : undefined}
      >
        <p className="text-sm text-muted-foreground/80">{content}</p>
      </div>
    </div>
  );
}
