"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
}

export function BarChart({
  title,
  description,
  data,
  height = 200,
  className,
  showValues = true,
  showGrid = true,
}: BarChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex h-40 items-center justify-center">
          <p className="text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value));
  const barWidth = 40;
  const gap = 20;
  const chartWidth = data.length * (barWidth + gap);

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
}

export function PieChart({
  title,
  description,
  data,
  size = 200,
  className,
  showLegend = true,
}: PieChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex h-40 items-center justify-center">
          <p className="text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const colors = [
    "hsl(var(--primary))",
    "hsl(var(--secondary))",
    "hsl(var(--accent))",
    "hsl(var(--destructive))",
    "hsl(var(--muted))",
    "hsl(var(--ring))",
  ];

  let currentAngle = 0;
  const slices = data.map((point, index) => {
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
      percentage: (percentage * 100).toFixed(1),
    };
  });

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
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <svg width={size} height={size} viewBox="0 0 200 200">
            {slices.map((slice, index) => (
              <path
                key={index}
                d={slice.path}
                fill={slice.color}
                className="transition-opacity hover:opacity-80"
              />
            ))}
          </svg>

          {showLegend && (
            <div className="grid gap-2">
              {slices.map((slice, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {slice.label} ({slice.percentage}%)
                  </span>
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
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex h-40 items-center justify-center">
          <p className="text-muted-foreground">No data available</p>
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
