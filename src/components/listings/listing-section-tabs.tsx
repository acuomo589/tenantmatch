import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ListingSection = "overview" | "explore-options" | "workbooks" | "proposals" | "outreach";

function ListingSectionTabs({
  sections,
  activeSection,
  onSelectSection,
}: {
  sections: ReadonlyArray<{ id: ListingSection; label: string; count?: number }>;
  activeSection: ListingSection;
  onSelectSection: (section: ListingSection) => void;
}) {
  return (
    <nav
      aria-label="Listing sections"
      className="sticky top-[4.75rem] z-10 flex flex-wrap gap-2 rounded-[1.5rem] border bg-background/90 p-2 shadow-sm backdrop-blur"
    >
      {sections.map((section) => (
        <Button
          key={section.id}
          variant={activeSection === section.id ? "default" : "ghost"}
          className={cn(
            "rounded-xl px-4",
            activeSection !== section.id && "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          onClick={() => onSelectSection(section.id)}
        >
          {section.label}
          {typeof section.count === "number" ? (
            <Badge variant={activeSection === section.id ? "secondary" : "outline"} className="ml-1">
              {section.count}
            </Badge>
          ) : null}
        </Button>
      ))}
    </nav>
  );
}

export { ListingSectionTabs };
