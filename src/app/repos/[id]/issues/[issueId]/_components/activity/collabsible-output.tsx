import { useEffect, useRef, useState } from "react";

const OUTPUT_COLLAPSED_HEIGHT = 80;

export default function CollapsibleOutput({ output }: { output: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;
    setOverflows(contentRef.current.scrollHeight > OUTPUT_COLLAPSED_HEIGHT);
  }, [output]);

  return (
    <div>
      <div
        ref={contentRef}
        className="relative overflow-hidden rounded-lg bg-muted transition-[max-height] duration-200"
        style={!expanded ? { maxHeight: OUTPUT_COLLAPSED_HEIGHT } : undefined}
      >
        <pre className="p-3 text-xs leading-5 overflow-auto text-muted-foreground/80">{output}</pre>
        {!expanded && overflows && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-muted to-transparent" />
        )}
      </div>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-1 mx-3 text-xs font-medium text-muted-foreground hover:underline cursor-pointer"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}