const COLORS = ['#94a3b8', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#ef4444'];

export default function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return <span className="score-badge score-badge--none">—</span>;
  }
  const color = COLORS[Math.min(Math.max(score, 0), 5)];
  return (
    <span className="score-badge" style={{ backgroundColor: color }}>
      {score}/5
    </span>
  );
}
