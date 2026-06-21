import Link from "next/link";
import type { ReactNode } from "react";
import { LayoutGrid, MoreHorizontal, PencilLine, Sparkles, Trash2 } from "lucide-react";
import { NoticeStack } from "@/components/app/notice-stack";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

function ListingPageHeader({
  title,
  subtitle,
  description,
  meta,
  stats,
  titleDraft,
  isEditingTitle,
  onTitleDraftChange,
  onStartEditingTitle,
  onCancelTitleEdit,
  onSaveTitle,
  onCreateWorkbook,
  onExploreOptions,
  onDelete,
  creatingWorkbook,
  exploringOptions,
  notices,
}: {
  title: string;
  subtitle: string;
  description: string;
  meta: Array<string>;
  stats: ReactNode;
  titleDraft: string;
  isEditingTitle: boolean;
  onTitleDraftChange: (value: string) => void;
  onStartEditingTitle: () => void;
  onCancelTitleEdit: () => void;
  onSaveTitle: () => void;
  onCreateWorkbook: () => void;
  onExploreOptions: () => void;
  onDelete: () => void;
  creatingWorkbook: boolean;
  exploringOptions: boolean;
  notices: Array<{ tone: "info" | "error" | "success"; message: string }>;
}) {
  return (
    <PageHeader
      eyebrow="Listing workspace"
      title={
        isEditingTitle ? (
          <div className="grid gap-3">
            <Input
              aria-label="Listing title"
              value={titleDraft}
              onChange={(event) => onTitleDraftChange(event.target.value)}
              className="h-12 text-2xl font-semibold md:h-14 md:text-4xl"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onSaveTitle();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  onCancelTitleEdit();
                }
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onCancelTitleEdit}>
                Cancel
              </Button>
              <Button onClick={onSaveTitle}>Save title</Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <div>{title}</div>
            <div className="text-base font-medium text-muted-foreground md:text-lg">{subtitle}</div>
          </div>
        )
      }
      description={!isEditingTitle ? description : undefined}
      meta={
        !isEditingTitle ? (
          <>
            <Button asChild variant="ghost" className="h-auto rounded-full px-0 text-sm font-medium text-muted-foreground hover:bg-transparent">
              <Link href="/workspace">Back to listings</Link>
            </Button>
            {meta.map((item) => (
              <Badge key={item} variant="outline" className="rounded-full bg-background px-3 py-1 text-xs">
                {item}
              </Badge>
            ))}
          </>
        ) : undefined
      }
      actions={
        isEditingTitle ? null : (
          <>
            <Button variant="outline" onClick={onStartEditingTitle}>
              <PencilLine className="size-4" />
              Edit title
            </Button>
            <Button variant="secondary" onClick={onExploreOptions} disabled={exploringOptions}>
              <Sparkles className="size-4" />
              {exploringOptions ? "Exploring..." : "Explore options"}
            </Button>
            <Button onClick={onCreateWorkbook} disabled={creatingWorkbook}>
              <LayoutGrid className="size-4" />
              {creatingWorkbook ? "Creating..." : "Create workbook"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                  <Trash2 className="mr-2 size-4" />
                  Delete listing
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )
      }
    >
      <div className="grid gap-5">
        {stats}
        <NoticeStack notices={notices} />
      </div>
    </PageHeader>
  );
}

export { ListingPageHeader };
