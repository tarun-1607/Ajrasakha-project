import logoUrl from "@/assets/ajrasakha-logo.png";
import { cn } from "@/lib/utils";

export function AjrasakhaLogo({
  className,
  size = 40,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <img
      src={logoUrl}
      alt="Ajrasakha"
      width={size}
      height={size}
      className={cn("rounded-xl object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

export function AjrasakhaWordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <AjrasakhaLogo size={36} />
      <div className="flex flex-col leading-none">
        <span className="font-display text-lg font-bold tracking-tight text-foreground">
          Ajrasakha
        </span>
        <span className="text-[11px] font-medium text-muted-foreground">
          Farmer's AI companion
        </span>
      </div>
    </div>
  );
}