import { MetricCard } from "@/components/app/metric-card";

function ListingStats({
  cards,
}: {
  cards: Array<{ label: string; value: string; detail?: string }>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <MetricCard key={card.label} label={card.label} value={card.value} detail={card.detail} />
      ))}
    </div>
  );
}

export { ListingStats };
