import { cn } from "~/lib/utils";

const CIRCLE_R = 14;
const CIRCLE_C = 2 * Math.PI * CIRCLE_R;
const SEGMENT_LENGTH = CIRCLE_C * 0.3;

function Spinner({
  className,
  strokeWidth = 4,
  ...props
}: React.ComponentProps<"svg">) {
  return (
    <svg
      role="status"
      aria-label="Loading"
      viewBox={`0 0 ${CIRCLE_R * 2 + 4} ${CIRCLE_R * 2 + 4}`}
      strokeWidth={strokeWidth}
      className={cn("size-4 animate-spin", className)}
      {...props}
    >
      <circle
        cx={CIRCLE_R + 2}
        cy={CIRCLE_R + 2}
        r={CIRCLE_R}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.25}
      />
      <circle
        cx={CIRCLE_R + 2}
        cy={CIRCLE_R + 2}
        r={CIRCLE_R}
        fill="none"
        stroke="currentColor"
        strokeDasharray={`${SEGMENT_LENGTH} ${CIRCLE_C - SEGMENT_LENGTH}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

export { Spinner };
