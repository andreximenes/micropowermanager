import { formatMoney } from '@/lib/format';

export type MonthRevenue = { month: string; revenue: number };

const BAR_WIDTH = 30;
const BAR_GAP = 18;
const AXIS_WIDTH = 40;
const TOP = 22;
const BASELINE = 180;
const HEIGHT = 204;
const TICKS = 4;

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

function monthOf(month: string, style: 'short' | 'long'): string {
  // en-GB abbreviates September as "Sept"; en keeps every month to three letters.
  return new Intl.DateTimeFormat(style === 'short' ? 'en' : 'en-GB', {
    month: style,
    year: style === 'long' ? 'numeric' : undefined,
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`));
}

/** A round axis maximum at or above `value`: 1, 2 or 5 times a power of ten. */
function niceCeiling(value: number): number {
  if (value <= 0) {
    return 1;
  }
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((multiple) => multiple * power >= value) ?? 10;
  return step * power;
}

/** Revenue per month as bars, the latest month highlighted; the figures also sit in a table for screen readers. */
export function RevenueChart({
  months,
  currency,
  className = '',
}: {
  months: MonthRevenue[];
  currency: string;
  className?: string;
}) {
  const ceiling = niceCeiling(Math.max(0, ...months.map((month) => month.revenue)));
  const width = AXIS_WIDTH + months.length * (BAR_WIDTH + BAR_GAP);
  const yOf = (value: number) => BASELINE - (value / ceiling) * (BASELINE - TOP);
  const ticks = Array.from({ length: TICKS + 1 }, (_, index) => (ceiling / TICKS) * index);
  const first = months[0];
  const last = months[months.length - 1];

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="block h-auto w-full"
        aria-hidden="true"
        data-testid="revenue-chart"
      >
        <g className="stroke-border">
          {ticks.map((tick) => (
            <line key={tick} x1={AXIS_WIDTH - 6} x2={width} y1={yOf(tick)} y2={yOf(tick)} />
          ))}
        </g>
        <g className="fill-muted-foreground text-[11px]" textAnchor="end">
          {ticks.map((tick) => (
            <text key={tick} x={AXIS_WIDTH - 10} y={yOf(tick) + 4}>
              {compact.format(tick)}
            </text>
          ))}
        </g>
        {months.map((month, index) => {
          const x = AXIS_WIDTH + index * (BAR_WIDTH + BAR_GAP) + BAR_GAP / 2;
          const y = yOf(month.revenue);
          const isLatest = index === months.length - 1;
          return (
            <g key={month.month}>
              <rect
                x={x}
                y={y}
                width={BAR_WIDTH}
                height={Math.max(0, BASELINE - y)}
                rx={3}
                className={isLatest ? 'fill-teal stroke-foreground' : 'fill-foreground'}
                strokeWidth={isLatest ? 1.5 : 0}
              >
                <title>{`${monthOf(month.month, 'long')}: ${formatMoney(month.revenue, currency)}`}</title>
              </rect>
              {isLatest && month.revenue > 0 ? (
                <text
                  x={x + BAR_WIDTH / 2}
                  y={y - 6}
                  textAnchor="middle"
                  className="fill-foreground text-[11px] font-semibold"
                >
                  {compact.format(month.revenue)}
                </text>
              ) : null}
              <text
                x={x + BAR_WIDTH / 2}
                y={HEIGHT - 4}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px]"
              >
                {monthOf(month.month, 'short')}
              </text>
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>
          Revenue by month
          {first && last
            ? `, ${monthOf(first.month, 'long')} to ${monthOf(last.month, 'long')}`
            : ''}
        </caption>
        <tbody>
          {months.map((month) => (
            <tr key={month.month}>
              <th scope="row">{monthOf(month.month, 'long')}</th>
              <td>{formatMoney(month.revenue, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
