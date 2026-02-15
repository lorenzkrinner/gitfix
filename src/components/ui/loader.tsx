import { cn } from "~/lib/utils";
import { ScaleLoader } from "react-spinners";

export default function Loader({ color, height, width, barCount, className }: { color?: string, height?: number, width?: number, barCount?: number, className?: string }) {
  return (
    <ScaleLoader color={color ?? "var(--muted-foreground)"} height={height ?? 16} width={width ?? 4} barCount={barCount ?? 4} className={cn("w-6", className)} />
  );
}