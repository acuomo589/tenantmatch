"use client";

import { Mail, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ListingRecord, OutreachContact, OutreachTarget } from "@/lib/workspace-client";
import { presentText, presentValue } from "@/lib/present";

function OutreachPanel({
  listing,
  listingOutreachTargets,
  activeOutreachTarget,
  selectedOutreachContact,
  onSelectTarget,
  onUpdateTarget,
  onGenerateEmail,
  onSendEmail,
  onLoadMoreContacts,
}: {
  listing: ListingRecord;
  listingOutreachTargets: OutreachTarget[];
  activeOutreachTarget: OutreachTarget | null;
  selectedOutreachContact: OutreachContact | null;
  onSelectTarget: (targetId: string) => void;
  onUpdateTarget: (targetId: string, updater: (target: OutreachTarget) => OutreachTarget) => void;
  onGenerateEmail: (targetId: string) => void;
  onSendEmail: (targetId: string) => void;
  onLoadMoreContacts: (targetId: string) => void;
}) {
  return (
    <Card data-surface>
      <CardContent className="grid gap-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold tracking-tight">Outreach</h2>
            <p className="text-sm text-muted-foreground">Turn workbook targets into contact research and ready-to-send outreach drafts.</p>
          </div>
          {activeOutreachTarget ? (
            <Select value={activeOutreachTarget.id} onChange={(event) => onSelectTarget(event.target.value)} className="min-w-[18rem]">
              {listingOutreachTargets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.workbookRow.business_name} · {target.workbookRow.city}, {target.workbookRow.state}
                </option>
              ))}
            </Select>
          ) : null}
        </div>

        {activeOutreachTarget ? (
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <OutreachMetric label="Business" value={activeOutreachTarget.workbookRow.business_name} />
              <OutreachMetric label="Category" value={activeOutreachTarget.workbookRow.category} />
              <OutreachMetric label="Distance" value={`${activeOutreachTarget.workbookRow.distance_miles} mi`} />
              <OutreachMetric label="Fit score" value={`${activeOutreachTarget.workbookRow.tenant_fit_score_100}/100`} />
              <OutreachMetric label="Move probability" value={`${activeOutreachTarget.workbookRow.move_probability_1_10}/10`} />
              <OutreachMetric label="Industry" value={presentText(activeOutreachTarget.industry, "TBD")} />
              <OutreachMetric label="Parent company" value={presentText(activeOutreachTarget.parentCompany, "Independent / TBD")} />
              <OutreachMetric label="Listing" value={presentText(listing.addressLine1, "Not provided")} />
            </div>

            <section className="rounded-[1.5rem] border bg-card p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Why this target fits</div>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{presentText(activeOutreachTarget.workbookRow.fit_summary)}</p>
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
              <section className="grid gap-4 rounded-[1.5rem] border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <h3 className="text-sm font-semibold">Email composer</h3>
                    <p className="text-sm text-muted-foreground">
                      To: {selectedOutreachContact?.name ?? "Select a contact"}
                      {selectedOutreachContact?.email ? ` <${selectedOutreachContact.email}>` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => onGenerateEmail(activeOutreachTarget.id)} disabled={activeOutreachTarget.generatingEmail}>
                      <Mail className="size-4" />
                      {activeOutreachTarget.generatingEmail ? "Generating..." : "Generate email"}
                    </Button>
                    <Button onClick={() => onSendEmail(activeOutreachTarget.id)} disabled={activeOutreachTarget.sendingEmail}>
                      <Send className="size-4" />
                      {activeOutreachTarget.sendingEmail ? "Sending..." : "Send via Gmail"}
                    </Button>
                  </div>
                </div>

                <label className="grid gap-2 text-sm font-medium">
                  <span>Subject</span>
                  <Input
                    value={activeOutreachTarget.emailSubject}
                    placeholder="Expansion opportunity at 875 Taylor Station Rd"
                    onChange={(event) =>
                      onUpdateTarget(activeOutreachTarget.id, (target) => ({
                        ...target,
                        emailSubject: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium">
                  <span>Email body</span>
                  <Textarea
                    rows={14}
                    value={activeOutreachTarget.emailBody}
                    onChange={(event) =>
                      onUpdateTarget(activeOutreachTarget.id, (target) => ({
                        ...target,
                        emailBody: event.target.value,
                      }))
                    }
                  />
                </label>

                <p className="text-sm text-muted-foreground">
                  {presentText(
                    activeOutreachTarget.lastSendMessage,
                    "Gmail send uses GMAIL_ACCESS_TOKEN and GMAIL_FROM_EMAIL environment configuration.",
                  )}
                </p>
              </section>

              <section className="grid gap-4 rounded-[1.5rem] border bg-card p-5">
                <div className="grid gap-1">
                  <h3 className="text-sm font-semibold">Suggested contacts</h3>
                  <p className="text-sm text-muted-foreground">Start with seeded contacts, then pull more as needed.</p>
                </div>

                <div className="grid gap-3">
                  {activeOutreachTarget.contacts.map((contact) => {
                    const selected = contact.id === activeOutreachTarget.selectedContactId;
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        className={`grid gap-1 rounded-2xl border px-4 py-3 text-left transition-colors ${
                          selected ? "border-primary bg-primary/5" : "hover:bg-muted/35"
                        }`}
                        onClick={() =>
                          onUpdateTarget(activeOutreachTarget.id, (target) => ({
                            ...target,
                            selectedContactId: contact.id,
                          }))
                        }
                      >
                        <div className="font-medium text-foreground">{contact.name}</div>
                        <div className="text-sm text-muted-foreground">{presentText(contact.title)}</div>
                        <div className="text-sm text-muted-foreground">{presentText(contact.email, "Email TBD")}</div>
                        <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          Confidence: {presentValue(contact.confidence)}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  onClick={() => onLoadMoreContacts(activeOutreachTarget.id)}
                  disabled={activeOutreachTarget.contactsLoading || !activeOutreachTarget.contactsHasMore}
                >
                  {activeOutreachTarget.contactsLoading
                    ? "Loading..."
                    : activeOutreachTarget.contactsHasMore
                      ? "Load more contacts"
                      : "No more contacts"}
                </Button>
              </section>
            </div>
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
            Open a workbook row to seed an outreach target here.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OutreachMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border bg-muted/35 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-semibold text-foreground">{value}</div>
    </article>
  );
}

export { OutreachPanel };
