"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale, useTranslations } from "next-intl";

interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  title?: string;
  description?: string;
  data: ChartDataPoint[];
  height?: number;
  className?: string;
  showValues?: boolean;
  showGrid?: boolean;
  horizontal?: boolean;
}

export function BarChart({
  title,
  description,
  data,
  height = 200,
  className,
  showValues = true,
  showGrid = true,
  horizontal = false,
}: BarChartProps) {
  const t = useTranslations("reports");
  const locale = useLocale();
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex h-40 items-center justify-center">
          <p className="text-muted-foreground">{t("common.noData")}</p>
        </CardContent>
      </Card>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value));
  const barWidth = 40;
  const gap = 20;
  const chartWidth = data.length * (barWidth + gap);

  if (horizontal) {
    const number = new Intl.NumberFormat(locale);
    return (
      <Card className={className}>
        {title && (
          <CardHeader>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </CardHeader>
        )}
        <CardContent>
          <ul className="flex flex-col justify-center gap-5" style={{ minHeight: height }}>
            {data.map((point, index) => (
              <li key={index} className="space-y-2">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium">{point.label}</span>
                  {showValues && <span className="font-semibold tabular-nums">{number.format(point.value)}</span>}
                </div>
                <div role="meter" aria-label={point.label} aria-valuemin={0} aria-valuemax={Math.max(1, maxValue)} aria-valuenow={point.value}
                  className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${maxValue > 0 ? point.value / maxValue * 100 : 0}%`, backgroundColor: point.color || "var(--chart-1)" }} />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </CardHeader>
      )}
      <CardContent>
        <div className="overflow-x-auto">
          <svg
            width="100%"
            height={height + 60}
            className="min-w-full"
            viewBox={`0 0 ${chartWidth + 60} ${height + 60}`}
          >
            {/* Grid lines */}
            {showGrid && (
              <>
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                  <g key={i}>
                    <line
                      x1="50"
                      y1={height * ratio + 10}
                      x2={chartWidth + 50}
                      y2={height * ratio + 10}
                      stroke="#e5e7eb"
                      strokeDasharray="4"
                    />
                    <text
                      x="45"
                      y={height * ratio + 14}
                      textAnchor="end"
                      className="fill-muted-foreground text-xs"
                    >
                      {Math.round(maxValue * (1 - ratio))}
                    </text>
                  </g>
                ))}
              </>
            )}

            {/* Bars */}
            {data.map((point, index) => {
              const barHeight = maxValue > 0 ? (point.value / maxValue) * height : 0;
              const x = 50 + index * (barWidth + gap);
              const y = height - barHeight + 10;

              return (
                <g key={index}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={point.color || "hsl(var(--primary))"}
                    rx="4"
                    className="transition-opacity hover:opacity-80"
                  />
                  {showValues && point.value > 0 && (
                    <text
                      x={x + barWidth / 2}
                      y={y - 8}
                      textAnchor="middle"
                      className="fill-foreground text-xs font-medium"
                    >
                      {point.value}
                    </text>
                  )}
                  <text
                    x={x + barWidth / 2}
                    y={height + 25}
                    textAnchor="middle"
                    className="fill-muted-foreground text-xs"
                  >
                    {point.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

interface PieChartProps {
  title?: string;
  description?: string;
  data: ChartDataPoint[];
  size?: number;
  className?: string;
  showLegend?: boolean;
  formatValue?: (value: number) => string;
  formatTotal?: (value: number) => string;
}

export function PieChart({
  title,
  description,
  data,
  size = 200,
  className,
  showLegend = true,
  formatValue,
  formatTotal,
}: PieChartProps) {
  const t = useTranslations("reports");
  const locale = useLocale();
  const points = (data ?? []).map((point) => ({
    ...point,
    value: Number.isFinite(point.value) && point.value > 0 ? point.value : 0,
  }));
  const total = points.reduce((sum, point) => sum + point.value, 0);
  if (total === 0) {
    return (
      <Card className={className}>
        {title && <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>}
        <CardContent className="flex h-56 items-center justify-center">
          <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
        </CardContent>
      </Card>
    );
  }

  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
  const number = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const valueLabel = formatValue ?? ((value: number) => number.format(value));

  let currentAngle = 0;
  const slices = points.map((point, index) => {
    const percentage = total > 0 ? point.value / total : 0;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    currentAngle += angle;

    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (startAngle + angle - 90) * (Math.PI / 180);

    const x1 = 100 + 80 * Math.cos(startRad);
    const y1 = 100 + 80 * Math.sin(startRad);
    const x2 = 100 + 80 * Math.cos(endRad);
    const y2 = 100 + 80 * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;

    const pathData = `M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return {
      path: pathData,
      color: point.color || colors[index % colors.length],
      label: point.label,
      value: point.value,
      percentage: percent.format(percentage),
      // Only one positive category can occupy a complete circle.
      isFullCircle: point.value > 0 && points.filter((item) => item.value > 0).length === 1,
    };
  });

  // Locale-aware compact total for the donut centre (e.g. "Rs 2.5M").
  const centerTotal = formatTotal ? formatTotal(total) : new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(total);

  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </CardHeader>
      )}
      <CardContent>
        <div className="flex flex-wrap items-center justify-center gap-6">
          <div className="relative max-w-full shrink-0" style={{ width: size, aspectRatio: "1" }}>
            <svg width="100%" height="100%" viewBox="0 0 200 200" role="img" aria-label={title ?? t("charts.total")}>
              <title>{slices.map((slice) => `${slice.label}: ${valueLabel(slice.value)} (${slice.percentage})`).join("; ")}</title>
              {slices.filter((slice) => slice.value > 0).map((slice, index) =>
                slice.isFullCircle ? (
                  <circle
                    key={index}
                    cx="100"
                    cy="100"
                    r="80"
                    fill={slice.color}
                    className="transition-opacity hover:opacity-80"
                  />
                ) : (
                  <path
                    key={index}
                    d={slice.path}
                    fill={slice.color}
                    className="transition-opacity hover:opacity-80"
                  />
                )
              )}
            </svg>
            {/* Donut hole with the aggregate total */}
            <div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-full bg-card"
              style={{ inset: "22%" }}
            >
              <span title={valueLabel(total)} className="max-w-full break-words px-1 text-center text-xl font-bold tracking-tight text-foreground tabular-nums">
                {centerTotal}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("charts.total")}
              </span>
            </div>
          </div>

          {showLegend && (
            <div className="grid min-w-0 flex-1 basis-48 gap-3">
              {slices.map((slice, index) => (
                <div
                  key={index}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="text-sm font-medium text-foreground">
                      {slice.label}
                    </span>
                  </div>
                  <div className="min-w-0 text-end tabular-nums">
                    <p className="break-words text-sm font-semibold">{valueLabel(slice.value)}</p>
                    <p className="text-xs text-muted-foreground">{slice.percentage}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface LineChartProps {
  title?: string;
  description?: string;
  data: ChartDataPoint[];
  height?: number;
  className?: string;
  showPoints?: boolean;
  showGrid?: boolean;
}

export function LineChart({
  title,
  description,
  data,
  height = 200,
  className,
  showPoints = true,
  showGrid = true,
}: LineChartProps) {
  const t = useTranslations("reports");
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex h-40 items-center justify-center">
          <p className="text-muted-foreground">{t("common.noData")}</p>
        </CardContent>
      </Card>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value));
  const minValue = Math.min(...data.map((d) => d.value));
  const range = maxValue - minValue || 1;
  const width = 100;
  const padding = 50;

  const points = data.map((point, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((point.value - minValue) / range) * (height - padding * 2);
    return { x, y, ...point };
  });

  const pathData = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </CardHeader>
      )}
      <CardContent>
        <svg width="100%" height={height + 40} viewBox={`0 0 ${width} ${height + 40}`}>
          {/* Grid lines */}
          {showGrid && (
            <>
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                <g key={i}>
                  <line
                    x1={padding}
                    y1={height * ratio + 20}
                    x2={width - padding}
                    y2={height * ratio + 20}
                    stroke="#e5e7eb"
                    strokeDasharray="2"
                  />
                </g>
              ))}
            </>
          )}

          {/* Line */}
          <path d={pathData} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />

          {/* Points */}
          {showPoints &&
            points.map((point, index) => (
              <g key={index}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill="hsl(var(--background))"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                />
                <text
                  x={point.x}
                  y={height + 35}
                  textAnchor="middle"
                  className="fill-muted-foreground text-xs"
                >
                  {point.label}
                </text>
              </g>
            ))}
        </svg>
      </CardContent>
    </Card>
  );
}
