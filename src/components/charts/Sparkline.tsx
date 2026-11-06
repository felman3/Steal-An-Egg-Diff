import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';

/** 8-term sparkline: de-emphasis line, current point in the accent. */
export function Sparkline({ values }: { values: (number | null)[] }) {
  const data = values.map((v, i) => ({ i, v }));
  const lastIndex = values.reduce<number>((acc, v, i) => (v !== null ? i : acc), -1);
  if (lastIndex < 1) return <div className="h-9" aria-hidden />;
  return (
    <div className="h-9" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line
            type="linear"
            dataKey="v"
            stroke="var(--series-muted)"
            strokeWidth={1.5}
            isAnimationActive={false}
            connectNulls={false}
            dot={(p: { cx?: number; cy?: number; index?: number }) =>
              p.index === lastIndex ? (
                <circle key="last" cx={p.cx} cy={p.cy} r={3.5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={1.5} />
              ) : (
                <g key={`d${p.index}`} />
              )
            }
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
