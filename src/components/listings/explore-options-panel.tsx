"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ExploreOptionsResult, ExploreOptionsScenario } from "@/lib/workspace-client";

function ExploreOptionsPanel({
  exploreOptionsResult,
  loading,
  activeTabId,
  onSelectTab,
  onGenerate,
}: {
  exploreOptionsResult: ExploreOptionsResult | null;
  loading: boolean;
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onGenerate: () => void;
}) {
  if (!exploreOptionsResult) {
    return (
      <Card data-surface>
        <CardContent className="grid gap-4 p-6">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold tracking-tight">Explore options</h2>
            <p className="text-sm text-muted-foreground">
              {loading ? "Evaluating the best directions for this property..." : "Run a structured developer lens on the listing to compare viable plays."}
            </p>
          </div>
          <div>
            <Button onClick={onGenerate} disabled={loading}>
              {loading ? "Exploring..." : "Generate options"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { analysis } = exploreOptionsResult;

  return (
    <Card data-surface>
      <CardContent className="grid gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold tracking-tight">Explore options</h2>
            <p className="text-sm text-muted-foreground">Compare the best-fit investment or repositioning paths before committing to a workbook.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{analysis.finalVerdict}</Badge>
            <Button variant="outline" onClick={onGenerate} disabled={loading}>
              {loading ? "Refreshing..." : "Re-run options"}
            </Button>
          </div>
        </div>

        <Tabs value={activeTabId} onValueChange={onSelectTab}>
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            {analysis.scenarios.map((scenario, index) => (
              <TabsTrigger key={scenario.id} value={scenario.id}>
                Option {index + 1}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="summary">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
              <section className="grid gap-4 rounded-[1.5rem] border bg-card p-5">
                <div className="grid gap-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Property snapshot</div>
                  <p className="text-sm leading-7 text-muted-foreground">{analysis.propertySnapshot}</p>
                </div>
                <div className="grid gap-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Developer summary</div>
                  <p className="text-sm leading-7 text-muted-foreground">{analysis.developerSummary}</p>
                </div>
              </section>

              <section className="grid gap-4 rounded-[1.5rem] border bg-muted/35 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Red flags</div>
                {analysis.redFlags.length ? (
                  <ul data-list-clean>
                    {analysis.redFlags.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">No red flags identified.</div>
                )}
              </section>
            </div>
          </TabsContent>

          {analysis.scenarios.map((scenario, index) => (
            <TabsContent key={scenario.id} value={scenario.id}>
              <ScenarioPanel scenario={scenario} index={index} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ScenarioPanel({ scenario, index }: { scenario: ExploreOptionsScenario; index: number }) {
  return (
    <div className="grid gap-4">
      <section className="grid gap-4 rounded-[1.5rem] border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Option {index + 1}</div>
            <h3 className="text-xl font-semibold tracking-tight">{scenario.name}</h3>
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{scenario.whyItFits}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Scope: {scenario.scopeLevel}</Badge>
            <Badge variant="outline">Entitlement: {scenario.entitlementDifficulty}</Badge>
            <Badge variant="outline">Financeability: {scenario.financeability}</Badge>
            <Badge variant="secondary">Margin: {scenario.marginView}</Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <OptionMetric label="Timeline" value={scenario.timeline} />
          <OptionMetric label="Target" value={scenario.targetTenantOrBuyer} />
          <OptionMetric label="Hard cost / SF" value={scenario.hardCostPerSfUsd} />
          <OptionMetric label="Soft costs" value={scenario.softCostPct} />
          <OptionMetric label="Contingency" value={scenario.contingencyPct} />
          <OptionMetric label="Revenue model" value={scenario.revenueModel} />
          <OptionMetric label="Exit strategy" value={scenario.exitStrategy} />
          <OptionMetric label="Operator skill" value={scenario.operatorSkillRequired} />
          <OptionMetric label="Exit flipability" value={scenario.exitFlipability} />
          <OptionMetric label="Total project cost" value={`${scenario.totalProjectCostLowUsd} - ${scenario.totalProjectCostHighUsd}`} />
        </div>
      </section>

      <div data-panel-grid>
        <OptionList title="What must be true" items={scenario.whatMustBeTrue} />
        <OptionList title="Build-out scope" items={scenario.buildOutScope} />
        <OptionList title="Incentives" items={scenario.incentives} />
        <OptionList title="Kill points" items={scenario.killPoints} />
      </div>
    </div>
  );
}

function OptionMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border bg-muted/35 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-semibold text-foreground">{value}</div>
    </article>
  );
}

function OptionList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="grid gap-3 rounded-[1.5rem] border bg-card p-5">
      <h4 className="text-sm font-semibold">{title}</h4>
      {items.length ? (
        <ul data-list-clean>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <div className="text-sm text-muted-foreground">No entries provided.</div>
      )}
    </section>
  );
}

export { ExploreOptionsPanel };
