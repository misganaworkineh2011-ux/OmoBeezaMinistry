// Small dependency-free SVG bar chart for the dashboard.
export default function BarChart({
  data,
  height = 160,
  color = "#1e4a7c",
  label,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  label: string;
}) {
  const width = 640;
  const pad = { top: 12, right: 8, bottom: 22, left: 30 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const step = innerW / Math.max(1, data.length);
  const barW = Math.max(4, step * 0.62);
  const every = Math.ceil(data.length / 10);
  const ticks = [...new Set([0, Math.ceil(max / 2), max])];

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      {ticks.map((t) => {
        const y = pad.top + innerH - (t / max) * innerH;
        return (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#e3e8ef" />
            <text x={pad.left - 6} y={y + 3} textAnchor="end">
              {t}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const h = (d.value / max) * innerH;
        const x = pad.left + i * step + (step - barW) / 2;
        return (
          <g key={d.label}>
            <rect x={x} y={pad.top + innerH - h} width={barW} height={h} rx={3} fill={color}>
              <title>{`${d.label}: ${d.value}`}</title>
            </rect>
            {i % every === 0 ? (
              <text x={x + barW / 2} y={height - 6} textAnchor="middle">
                {d.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
