import { cn } from "~/lib/utils";

export function LogoIcon({ className }: { className?: string }) {
  return (
    <div className={cn("size-5", className)}>
      <svg className="h-full w-full" viewBox="0 0 48 48" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="18" fill="#21B08A"/>
        <path d="M32 18.6666C33.4728 18.6666 34.6667 17.4727 34.6667 15.9999C34.6667 14.5272 33.4728 13.3333 32 13.3333C30.5273 13.3333 29.3333 14.5272 29.3333 15.9999C29.3333 17.4727 30.5273 18.6666 32 18.6666Z" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M16 34.6666C17.4728 34.6666 18.6667 33.4727 18.6667 31.9999C18.6667 30.5272 17.4728 29.3333 16 29.3333C14.5273 29.3333 13.3333 30.5272 13.3333 31.9999C13.3333 33.4727 14.5273 34.6666 16 34.6666Z" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M16 29.3333V12" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M18.6667 32.0001H20C24.6667 32.0001 32 29.2001 32 20.6667V18.6667" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  );
}

export default function Logo({
  className,
  classNames,
}: {
  className?: string;
  classNames?: {
    icon?: string;
    text?: string;
  };
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <LogoIcon className={cn(classNames?.icon)} />
      <span className={cn("text-lg font-semibold text-foreground", classNames?.text)}>Gitfix</span>
    </div>
  );
}