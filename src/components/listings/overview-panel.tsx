"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ListingRecord } from "@/lib/workspace-client";
import { presentText } from "@/lib/present";

function OverviewPanel({
  listing,
  onSaveOverview,
}: {
  listing: ListingRecord;
  onSaveOverview: (draft: { summary: string; highlights: string[]; notes: string[] }) => void;
}) {
  const featureItems = getFeatureItems(listing);
  const noteItems = getNoteItems(listing);
  const [isEditing, setIsEditing] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState(listing.listingSummary ?? "");
  const [highlightsDraft, setHighlightsDraft] = useState(featureItems.join("\n"));
  const [notesDraft, setNotesDraft] = useState(noteItems.join("\n"));

  useEffect(() => {
    if (isEditing) return;
    setSummaryDraft(listing.listingSummary ?? "");
    setHighlightsDraft(featureItems.join("\n"));
    setNotesDraft(noteItems.join("\n"));
  }, [featureItems, isEditing, listing.listingSummary, noteItems]);

  const nextSummary = summaryDraft.trim();
  const nextHighlights = parseEditableItems(highlightsDraft);
  const nextNotes = parseEditableItems(notesDraft);
  const hasChanges =
    nextSummary !== (listing.listingSummary?.trim() ?? "") ||
    !areStringArraysEqual(featureItems, nextHighlights) ||
    !areStringArraysEqual(noteItems, nextNotes);

  return (
    <Card data-surface>
      <CardContent className="grid gap-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Overview</h2>
            <p className="text-sm text-muted-foreground">Maintain the clean internal brief for this listing.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSummaryDraft(listing.listingSummary ?? "");
                    setHighlightsDraft(featureItems.join("\n"));
                    setNotesDraft(noteItems.join("\n"));
                    setIsEditing(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    onSaveOverview({ summary: nextSummary, highlights: nextHighlights, notes: nextNotes });
                    setIsEditing(false);
                  }}
                  disabled={!hasChanges}
                >
                  Save overview
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                Edit overview
              </Button>
            )}
          </div>
        </div>

        <section className="grid gap-3 rounded-[1.5rem] border bg-muted/35 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Listing summary</div>
          {isEditing ? (
            <Textarea rows={5} value={summaryDraft} onChange={(event) => setSummaryDraft(event.target.value)} />
          ) : (
            <p className="text-sm leading-7 text-muted-foreground">{presentText(listing.listingSummary, "No summary has been captured yet.")}</p>
          )}
        </section>

        <div data-panel-grid>
          <EditableListPanel
            title="Highlights"
            description="The best reasons this deal might work."
            items={featureItems}
            draft={highlightsDraft}
            isEditing={isEditing}
            placeholder="One highlight per line"
            onChange={setHighlightsDraft}
          />
          <EditableListPanel
            title="Notes and risks"
            description="Important constraints, diligence items, and cautions."
            items={noteItems}
            draft={notesDraft}
            isEditing={isEditing}
            placeholder="One note per line"
            onChange={setNotesDraft}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function EditableListPanel({
  title,
  description,
  items,
  draft,
  isEditing,
  placeholder,
  onChange,
}: {
  title: string;
  description: string;
  items: string[];
  draft: string;
  isEditing: boolean;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className="grid gap-3 rounded-[1.5rem] border bg-card p-5">
      <div className="grid gap-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {isEditing ? (
        <Textarea rows={10} value={draft} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : items.length ? (
        <ul data-list-clean>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">No items yet.</div>
      )}
    </section>
  );
}

function getFeatureItems(listing: ListingRecord): string[] {
  return cleanEditableItems(listing.features.map((feature) => feature.featureValueText ?? feature.sourceText ?? ""));
}

function getNoteItems(listing: ListingRecord): string[] {
  return cleanEditableItems(listing.disclosures.map((disclosure) => disclosure.text));
}

function parseEditableItems(value: string): string[] {
  return cleanEditableItems(value.split("\n").map((item) => item.replace(/^[-*•]\s*/, "")));
}

function cleanEditableItems(items: string[]): string[] {
  const seen = new Set<string>();

  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
}

export { OverviewPanel };
