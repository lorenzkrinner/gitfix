import { useEffect, useRef, useState } from "react";
import { Separator } from "~/components/ui/separator";
import { getIcon } from 'material-file-icons';
import { Spinner } from "~/components/ui/spinner";
import { Shimmer } from "~/components/ai-elements/shimmer";
import { Time } from "../issue-timeline";

const DIFF_COLLAPSED_HEIGHT = 80;
const DIFF_STREAMING_HEIGHT = 120;

function parseDiffLines(diff: string): { text: string; type: "add" | "remove" | "header" | "context" }[] {
  return diff.split("\n").map((line) => {
    if (line.startsWith("@@")) return { text: line, type: "header" };
    if (line.startsWith("+")) return { text: line, type: "add" };
    if (line.startsWith("-")) return { text: line, type: "remove" };
    return { text: line, type: "context" };
  });
}
export function FileIcon({ filePath }: { filePath: string }) {
  const icon = getIcon(filePath);

  return (
    <span
      className="inline-flex size-full"
      dangerouslySetInnerHTML={{ __html: icon.svg }}
    />
  );
}

export default function DiffViewer({ isStreaming, diff, filePath, createdAt }: { isStreaming: boolean, diff: string, filePath: string, createdAt: Date }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const lines = parseDiffLines(diff);
  const additions = lines.filter((l) => l.type === "add").length;
  const deletions = lines.filter((l) => l.type === "remove").length;

  useEffect(() => {
    if (!contentRef.current) return;

    if (isStreaming) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    } else {
      setOverflows(contentRef.current.scrollHeight > DIFF_COLLAPSED_HEIGHT);
    }
  }, [diff, isStreaming]);

  return (
    <div className="rounded-lg bg-muted py-2">
      <div className="w-full flex justify-between items-center px-2">
        <div className="flex items-center gap-1">
          {isStreaming && (
            <div className="flex items-center gap-1 mr-2">
              <Spinner className="size-2 mr-1" />
              <Shimmer duration={1} className="text-xs">Editing...</Shimmer>
            </div>
          )}
          <div className="size-4 shrink-0 mr-1 mb-0.5">
            <FileIcon filePath={filePath} />
          </div>
          <span className="text-xs text-foreground">{filePath}</span>
          {additions > 0 && <span className="text-xs text-green-600">+{additions}</span>}
          {deletions > 0 && <span className="text-xs text-red-600">-{deletions}</span>}
        </div>
        <Time date={createdAt} />
      </div>
      <Separator className="my-2 bg-border/60" />
      <div
        ref={contentRef}
        className={`relative bg-transparent transition-[max-height] duration-200 ${
          isStreaming ? "overflow-y-auto hide-scrollbar" : "overflow-hidden"
        }`}
        style={
          isStreaming
            ? { maxHeight: DIFF_STREAMING_HEIGHT }
            : !expanded
              ? { maxHeight: DIFF_COLLAPSED_HEIGHT }
              : undefined
        }
      >
        <pre className="px-3 pt-1 pb-2 text-xs leading-5 font-mono overflow-x-auto">
          {lines
            .filter((line) => line.type !== "header")
            .map((line, i) => (
              <div
                key={i}
                className={
                  line.type === "add"
                    ? "text-green-400 bg-green-950/30"
                    : line.type === "remove"
                      ? "text-red-400 bg-red-950/30"
                      : "text-neutral-400"
                }
              >
                {line.text}
              </div>
            ))}
        </pre>
        {!isStreaming && !expanded && overflows && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-muted to-transparent" />
        )}
      </div>
      {!isStreaming && overflows && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-xs font-medium text-muted-foreground hover:underline cursor-pointer mx-2"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

