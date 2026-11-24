import * as d3 from 'd3';
import { Activity, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface DailyRevenueWatchPoint {
  date: string;
  label: string;
  verifiedRevenueUsd: number;
  verifiedTxCount: number;
  watchSeconds: number;
  watchHours: number;
  creatorSupportUsd: number;
}

export interface RevenueWatchTrendsResponse {
  generatedAt: string;
  windowDays: number;
  days: DailyRevenueWatchPoint[];
  totals: {
    totalVerifiedRevenueUsd: number;
    totalWatchHours: number;
    totalWatchMinutes: number;
    activeVerifiedDays: number;
    creatorSharePercent: number;
  };
}

type SeriesViewMode = 'combined' | 'revenue' | 'watch';

interface D3RevenueWatchTrendChartProps {
  externalRefreshKey?: number;
}

const SVG_WIDTH = 840;
const SVG_HEIGHT = 296;
const MARGIN = { top: 22, right: 56, bottom: 38, left: 56 };
const INNER_WIDTH = SVG_WIDTH - MARGIN.left - MARGIN.right;
const INNER_HEIGHT = SVG_HEIGHT - MARGIN.top - MARGIN.bottom;

export function D3RevenueWatchTrendChart({ externalRefreshKey = 0 }: D3RevenueWatchTrendChartProps) {
  const [data, setData] = useState<RevenueWatchTrendsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<SeriesViewMode>('combined');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const loadTrends = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics/revenue-watch-trends');
      if (res.ok) {
        const json = (await res.json()) as RevenueWatchTrendsResponse;
        setData(json);
      }
    } catch {
      // Preserve existing state cleanly on network hiccup
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTrends();
  }, [loadTrends, externalRefreshKey]);

  const days = data?.days ?? [];

  const d3Geometry = useMemo(() => {
    if (days.length === 0) {
      return null;
    }

    const xScale = d3
      .scaleBand<string>()
      .domain(days.map((d) => d.date))
      .range([0, INNER_WIDTH])
      .padding(0.28);

    const maxRev = Math.max(d3.max(days, (d) => d.verifiedRevenueUsd) ?? 0, 10);
    const maxWatch = Math.max(d3.max(days, (d) => d.watchHours) ?? 0, 1);

    const yRevScale = d3.scaleLinear().domain([0, maxRev * 1.15]).nice().range([INNER_HEIGHT, 0]);
    const yWatchScale = d3.scaleLinear().domain([0, maxWatch * 1.18]).nice().range([INNER_HEIGHT, 0]);

    const bandwidth = xScale.bandwidth();
    const watchLineGenerator = d3
      .line<DailyRevenueWatchPoint>()
      .x((d) => (xScale(d.date) ?? 0) + bandwidth / 2)
      .y((d) => yWatchScale(d.watchHours))
      .curve(d3.curveMonotoneX);

    const watchAreaGenerator = d3
      .area<DailyRevenueWatchPoint>()
      .x((d) => (xScale(d.date) ?? 0) + bandwidth / 2)
      .y0(INNER_HEIGHT)
      .y1((d) => yWatchScale(d.watchHours))
      .curve(d3.curveMonotoneX);

    const revTicks = yRevScale.ticks(4);
    const watchTicks = yWatchScale.ticks(4);
    const xTickDates = days.filter((_, idx) => idx % 5 === 0 || idx === days.length - 1);

    const bars = days.map((d, idx) => {
      const x = xScale(d.date) ?? 0;
      const y = yRevScale(d.verifiedRevenueUsd);
      const height = Math.max(d.verifiedRevenueUsd > 0 ? 3 : 0, INNER_HEIGHT - y);
      return {
        idx,
        point: d,
        x,
        cx: x + bandwidth / 2,
        y,
        width: bandwidth,
        height,
        watchY: yWatchScale(d.watchHours)
      };
    });

    return {
      bars,
      revTicks: revTicks.map((t) => ({ value: t, y: yRevScale(t) })),
      watchTicks: watchTicks.map((t) => ({ value: t, y: yWatchScale(t) })),
      xTicks: xTickDates.map((d) => ({
        date: d.date,
        label: d.label,
        cx: (xScale(d.date) ?? 0) + bandwidth / 2
      })),
      watchLinePath: watchLineGenerator(days) ?? '',
      watchAreaPath: watchAreaGenerator(days) ?? ''
    };
  }, [days]);

  const activePoint =
    hoveredIdx !== null && days[hoveredIdx] ? days[hoveredIdx] : days[days.length - 1] ?? null;

  return (
    <div className="p-6 sm:p-8 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg mb-8 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
        <div>
          <p className="text-xs font-semibold text-[#14532D] dark:text-[#4ADE80] mb-1 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            <span>D3.js 30-Day Dual-Axis Telemetry · Verified Revenue vs. Watch Time</span>
          </p>
          <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#141413] dark:text-[#F5F3EE]">
            Daily Verified Revenue (USD) vs. Video Watch Time Trends
          </h3>
          <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-1">
            Rolling 30-day D3 comparison pairing verified gateway settlements (USD) against tracked audience watch hours across web and app reels.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="D3 chart series filter"
            className="inline-flex items-center gap-1 p-1 bg-[#F5F2EB] dark:bg-[#0D0D0C] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md"
          >
            {(
              [
                { id: 'combined', label: 'Combined' },
                { id: 'revenue', label: 'Verified USD' },
                { id: 'watch', label: 'Watch Time' }
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={viewMode === opt.id}
                onClick={() => setViewMode(opt.id)}
                className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                  viewMode === opt.id
                    ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] shadow-xs font-semibold'
                    : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => void loadTrends()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-[#FBF9F5] dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#141413] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh D3</span>
          </button>
        </div>
      </div>

      {/* 30-Day Summary + Selected Day Inspector */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
        <div className="p-3.5 bg-[#FBF9F5] dark:bg-[#121210] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
          <span className="text-[#57534E] dark:text-[#A8A29E] block mb-0.5">30d Verified Revenue USD</span>
          <span className="font-mono text-lg font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
            ${(data?.totals.totalVerifiedRevenueUsd ?? 0).toFixed(2)}
          </span>
        </div>

        <div className="p-3.5 bg-[#FBF9F5] dark:bg-[#121210] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
          <span className="text-[#57534E] dark:text-[#A8A29E] block mb-0.5">30d Total Watch Time</span>
          <span className="font-mono text-lg font-bold text-[#991B1B] dark:text-[#F87171] tabular-nums">
            {(data?.totals.totalWatchHours ?? 0).toFixed(1)} hrs ({(data?.totals.totalWatchMinutes ?? 0).toLocaleString()}m)
          </span>
        </div>

        <div className="p-3.5 bg-[#FBF9F5] dark:bg-[#121210] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
          <span className="text-[#57534E] dark:text-[#A8A29E] block mb-0.5">
            Selected Day ({activePoint ? activePoint.label : '—'})
          </span>
          <span className="font-mono text-sm font-semibold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
            ${activePoint ? activePoint.verifiedRevenueUsd.toFixed(2) : '0.00'} ·{' '}
            {activePoint ? activePoint.watchHours.toFixed(2) : '0.00'}h
          </span>
        </div>

        <div className="p-3.5 bg-[#FBF9F5] dark:bg-[#121210] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
          <span className="text-[#57534E] dark:text-[#A8A29E] block mb-0.5">Verified Days / Share</span>
          <span className="font-mono text-sm font-semibold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
            {data?.totals.activeVerifiedDays ?? 0}/30 active · {data?.totals.creatorSharePercent ?? 70}% Creator Split
          </span>
        </div>
      </div>

      {/* Responsive D3 SVG Chart */}
      <div className="w-full overflow-x-auto">
        {!d3Geometry ? (
          <div className="h-64 w-full bg-[#F5F2EB] dark:bg-[#1C1B19] rounded-md" />
        ) : (
          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            role="img"
            aria-label="D3 chart visualizing daily verified revenue in USD versus watch time hours over the last 30 days"
            className="w-full h-auto min-w-[620px] select-none"
          >
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              {/* Horizontal Gridlines & Left Y-Axis (Verified USD) */}
              {d3Geometry.revTicks.map((tick) => (
                <g key={`rev-tick-${tick.value}`} transform={`translate(0,${tick.y})`}>
                  <line
                    x1={0}
                    x2={INNER_WIDTH}
                    y1={0}
                    y2={0}
                    className="stroke-[#E5E2DC] dark:stroke-[#2C2A26]"
                    strokeDasharray="3 3"
                  />
                  {(viewMode === 'combined' || viewMode === 'revenue') && (
                    <text
                      x={-10}
                      y={4}
                      textAnchor="end"
                      className="fill-[#14532D] dark:fill-[#4ADE80] font-mono text-[10px]"
                    >
                      ${tick.value.toFixed(0)}
                    </text>
                  )}
                </g>
              ))}

              {/* Right Y-Axis (Watch Hours) */}
              {(viewMode === 'combined' || viewMode === 'watch') &&
                d3Geometry.watchTicks.map((tick) => (
                  <text
                    key={`watch-tick-${tick.value}`}
                    x={INNER_WIDTH + 10}
                    y={tick.y + 4}
                    textAnchor="start"
                    className="fill-[#991B1B] dark:fill-[#F87171] font-mono text-[10px]"
                  >
                    {tick.value.toFixed(1)}h
                  </text>
                ))}

              {/* Watch Time D3 Area Fill */}
              {(viewMode === 'combined' || viewMode === 'watch') && d3Geometry.watchAreaPath && (
                <path
                  d={d3Geometry.watchAreaPath}
                  className="fill-[#991B1B]/10 dark:fill-[#F87171]/10"
                />
              )}

              {/* Verified Revenue D3 Bars */}
              {(viewMode === 'combined' || viewMode === 'revenue') &&
                d3Geometry.bars.map((bar) => {
                  const focused = hoveredIdx === bar.idx;
                  return (
                    <rect
                      key={`bar-${bar.point.date}`}
                      x={bar.x}
                      y={bar.y}
                      width={bar.width}
                      height={bar.height}
                      rx={2}
                      className={
                        focused
                          ? 'fill-[#16A34A] dark:fill-[#86EFAC]'
                          : 'fill-[#14532D]/85 dark:fill-[#4ADE80]/80'
                      }
                    />
                  );
                })}

              {/* Watch Time D3 Monotone Curve */}
              {(viewMode === 'combined' || viewMode === 'watch') && d3Geometry.watchLinePath && (
                <path
                  d={d3Geometry.watchLinePath}
                  fill="none"
                  strokeWidth={2.25}
                  className="stroke-[#991B1B] dark:stroke-[#F87171]"
                />
              )}

              {/* Data Points + Hover Columns */}
              {d3Geometry.bars.map((bar) => {
                const isActive =
                  hoveredIdx === bar.idx || (hoveredIdx === null && bar.idx === days.length - 1);
                return (
                  <g
                    key={`col-${bar.point.date}`}
                    onMouseEnter={() => setHoveredIdx(bar.idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="cursor-pointer"
                  >
                    {isActive && (
                      <line
                        x1={bar.cx}
                        x2={bar.cx}
                        y1={0}
                        y2={INNER_HEIGHT}
                        className="stroke-[#78716C]/50 dark:stroke-[#A8A29E]/40"
                        strokeWidth={1}
                      />
                    )}
                    {(viewMode === 'combined' || viewMode === 'watch') && (
                      <circle
                        cx={bar.cx}
                        cy={bar.watchY}
                        r={isActive ? 4.5 : 2.5}
                        className="fill-[#991B1B] dark:fill-[#F87171] stroke-white dark:stroke-[#171715]"
                        strokeWidth={1.5}
                      />
                    )}
                    {/* Invisible wide hit column for smooth pointer scrubbing */}
                    <rect
                      x={bar.x - 2}
                      y={0}
                      width={bar.width + 4}
                      height={INNER_HEIGHT}
                      fill="transparent"
                    />
                  </g>
                );
              })}

              {/* Bottom Baseline & X-Axis Labels */}
              <line
                x1={0}
                x2={INNER_WIDTH}
                y1={INNER_HEIGHT}
                y2={INNER_HEIGHT}
                className="stroke-[#D6D1C7] dark:stroke-[#3A3732]"
              />
              {d3Geometry.xTicks.map((tick) => (
                <text
                  key={`x-tick-${tick.date}`}
                  x={tick.cx}
                  y={INNER_HEIGHT + 20}
                  textAnchor="middle"
                  className="fill-[#57534E] dark:fill-[#A8A29E] font-mono text-[10px]"
                >
                  {tick.label}
                </text>
              ))}
            </g>
          </svg>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E5E2DC] dark:border-[#2C2A26] text-xs text-[#57534E] dark:text-[#A8A29E]">
        <div className="flex flex-wrap items-center gap-5">
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-3 bg-[#14532D] dark:bg-[#4ADE80] inline-block rounded-xs" />
            <span>Daily Verified Revenue (USD · Left Axis)</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-4 h-0.5 bg-[#991B1B] dark:bg-[#F87171] inline-block" />
            <span>Daily Watch Time (Hours · Right Axis)</span>
          </span>
        </div>
        <span className="font-mono text-[11px]">
          Hover or tap any day column to inspect verified revenue &amp; watch hours
        </span>
      </div>
    </div>
  );
}
