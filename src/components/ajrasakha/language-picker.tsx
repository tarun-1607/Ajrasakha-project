import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useLanguage, SUPPORTED_LANGUAGES, type LanguageCode } from "@/hooks/use-language";
import { Globe, Check } from "lucide-react";

export function LanguagePicker() {
  const { language, changeLanguage } = useLanguage();

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 rounded-xl border-border/70 hover:bg-accent/50 hover:text-accent-foreground transition-all duration-200 shadow-sm"
        >
          <Globe className="size-4 text-primary animate-pulse" />
          <span className="font-medium text-xs sm:text-sm">{currentLang.nativeName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 rounded-xl border border-border/70 bg-card p-1 shadow-md animate-in fade-in slide-in-from-top-2 duration-200"
      >
        {SUPPORTED_LANGUAGES.map((lang) => {
          const isSelected = lang.code === language;
          return (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => changeLanguage(lang.code as LanguageCode)}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs sm:text-sm cursor-pointer transition-colors ${
                isSelected
                  ? "bg-primary/10 text-primary font-semibold"
                  : "hover:bg-accent/50 text-foreground/80 hover:text-foreground"
              }`}
            >
              <div className="flex flex-col">
                <span className="font-display font-medium">{lang.nativeName}</span>
                <span className="text-[10px] text-muted-foreground">{lang.label}</span>
              </div>
              {isSelected && <Check className="size-4 text-primary shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
