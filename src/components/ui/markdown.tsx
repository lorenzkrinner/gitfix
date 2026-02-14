"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const COLLAPSED_MAX_HEIGHT = 144; // ~6 lines at text-sm (6 * 24px)

const COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mb-3 mt-4 text-xl font-semibold first:mt-0 leading-tight">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-3 text-lg font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-2 last:mb-0 text-sm">{children}</p>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline hover:text-primary/80"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 list-disc pl-6 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal pl-6 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="mb-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-muted-foreground/30 pl-4 italic text-muted-foreground last:mb-0">
      {children}
    </blockquote>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className="text-xs">{children}</code>
      );
    }
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-2 overflow-auto rounded-lg bg-muted p-3 last:mb-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="mb-2 overflow-auto last:mb-0">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-muted px-3 py-2 text-left font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-3 py-2">{children}</td>
  ),
  hr: () => <hr className="my-4 border-border" />,
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt ?? ""} className="my-2 max-w-full rounded" />
  ),
  input: ({ checked, disabled, ...rest }) => (
    <input
      {...rest}
      checked={checked}
      disabled={disabled}
      className="mr-1.5 align-middle"
    />
  ),
};

export function Markdown({
  children,
  className,
  collapsible = false,
}: {
  children: string;
  className?: string;
  collapsible?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsible || !contentRef.current) return;
    setOverflows(contentRef.current.scrollHeight > COLLAPSED_MAX_HEIGHT);
  }, [collapsible, children]);

  return (
    <div className={className}>
      <div
        ref={contentRef}
        className="relative overflow-hidden transition-[max-height] duration-200"
        style={
          collapsible && !expanded
            ? { maxHeight: COLLAPSED_MAX_HEIGHT }
            : undefined
        }
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
          {children}
        </ReactMarkdown>
        {collapsible && !expanded && overflows && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-background to-transparent" />
        )}
      </div>
      {collapsible && overflows && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-1 text-xs font-medium text-primary hover:underline cursor-pointer"
        >
          {expanded ? "View less" : "View more"}
        </button>
      )}
    </div>
  );
}
