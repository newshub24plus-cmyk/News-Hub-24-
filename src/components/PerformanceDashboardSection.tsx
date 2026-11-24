import { ArrowUpRight, BarChart3, Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { NewsArticle } from '../data/newsData';
import { D3RevenueWatchTrendChart } from './D3RevenueWatchTrendChart';

export type AnalyticsTimeframe = 'day' | 'week' | 'month' | 'annual';

export interface AnalyticsSeriesPoint {
  label: string;
  views: number;
}

export interface CatalogAnalyticsRow {
  catalog: string;
  storyCount: number;
  dayViews: number;
  weekViews: number;
  monthViews: number;
  annualViews: number;
  totalViews: number;
}

export interface TopArticleAnalyticsRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  bureau: string;
  dayViews: number;
  weekViews: number;
  monthViews: number;
  annualViews: number;
  totalViews: number;
}

export interface AnalyticsResponse {
  generatedAt: string;
  totalArticles: number;
  summary: {
    day: number;
    week: number;
    month: number;
    annual: number;
    allTime: number;
  };
  series: Record<AnalyticsTimeframe, AnalyticsSeriesPoint[]>;
  byCatalog: CatalogAnalyticsRow[];
  topArticles: TopArticleAnalyticsRow[];
}

interface PerformanceDashboardSectionProps {
  analytics: AnalyticsResponse | null;
  loading: boolean;
  articles: NewsArticle[];
  onSelectArticle: (article: NewsArticle) => void;
  trendsRefreshKey?: number;
}

const TIMEFRAME_LABELS: Record<AnalyticsTimeframe, { title: string; subtitle: string; tab: string }> = {
  day: { title: 'Daily Views (24 Hours)', subtitle: '3-hour audience intervals today (UTC)', tab: 'Day (24h)' },
  week: { title: 'Weekly Views (7 Days)', subtitle: 'Rolling 7-day broadsheet & wire readership', tab: 'Week (7d)' },
  month: { title: 'Monthly Views (30 Days)', subtitle: 'Four-week readership cadence across all catalogs', tab: 'Month (30d)' },
  annual: { title: 'Annual Views (12 Months)', subtitle: 'Twelve-month cumulative readership & syndication reach', tab: 'Annual (12m)' }
};

export function PerformanceDashboardSection({
  analytics,
  loading,
  articles,
  onSelectArticle,
  trendsRefreshKey = 0
}: PerformanceDashboardSectionProps) {
  const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>('week');
  const [selectedBarIdx, setSelectedBarIdx] = useState<number | null>(null);
  const [exportingCsv, setExportingCsv] = useState<boolean>(false);
  const [exportStatus, setExportStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const activeSeries = useMemo(
    () => (analytics ? analytics.series[timeframe] : []),
    [analytics, timeframe]
  );

  const maxBarValue = useMemo(() => {
    if (!activeSeries.length) return 1;
    return Math.max(...activeSeries.map((pt) => pt.views), 1);
  }, [activeSeries]);

  const activePoint =
    selectedBarIdx !== null && activeSeries[selectedBarIdx]
      ? activeSeries[selectedBarIdx]
      : activeSeries[activeSeries.length - 1] ?? null;

  const getViewsForFrame = (
    row: { dayViews: number; weekViews: number; monthViews: number; annualViews: number },
    frame: AnalyticsTimeframe
  ) => {
    if (frame === 'day') return row.dayViews;
    if (frame === 'week') return row.weekViews;
    if (frame === 'month') return row.monthViews;
    return row.annualViews;
  };

  const escapeCsvCell = (value: string | number | null | undefined): string => {
    const raw = value === null || value === undefined ? '' : String(value);
    if (/[",\r\n]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };

  const toCsvRow = (cells: Array<string | number | null | undefined>): string =>
    cells.map((cell) => escapeCsvCell(cell)).join(',');

  const handleExportCsv = async () => {
    if (exportingCsv) return;
    setExportingCsv(true);
    setExportStatus(null);

    try {
      const response = await fetch('/api/analytics', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) {
        throw new Error(`Analytics request failed (HTTP ${response.status}).`);
      }

      const freshAnalytics = (await response.json()) as AnalyticsResponse;
      const seriesPoints = freshAnalytics.series?.[timeframe] ?? [];
      const dateStamp = new Date().toISOString().slice(0, 10);

      const csvLines: string[] = [
        toCsvRow(['News Hub 24+ Content Performance Analytics']),
        toCsvRow(['Generated At (UTC)', freshAnalytics.generatedAt]),
        toCsvRow(['Active Reporting Horizon', TIMEFRAME_LABELS[timeframe].title]),
        toCsvRow(['Total Tracked Stories', freshAnalytics.totalArticles]),
        '',
        toCsvRow(['Horizon Summary', 'Views']),
        toCsvRow(['Daily Views (24h)', freshAnalytics.summary.day]),
        toCsvRow(['Weekly Views (7d)', freshAnalytics.summary.week]),
        toCsvRow(['Monthly Views (30d)', freshAnalytics.summary.month]),
        toCsvRow(['Annual Views (12m)', freshAnalytics.summary.annual]),
        toCsvRow(['All-Time Views', freshAnalytics.summary.allTime]),
        '',
        toCsvRow([`${TIMEFRAME_LABELS[timeframe].title} Series`, 'Views']),
        ...seriesPoints.map((pt) => toCsvRow([pt.label, pt.views])),
        '',
        toCsvRow([
          'Catalog',
          'Stories',
          'Day Views',
          'Week Views',
          'Month Views',
          'Annual Views',
          'All-Time Views'
        ]),
        ...(freshAnalytics.byCatalog ?? []).map((row) =>
          toCsvRow([
            row.catalog,
            row.storyCount,
            row.dayViews,
            row.weekViews,
            row.monthViews,
            row.annualViews,
            row.totalViews
          ])
        ),
        '',
        toCsvRow([
          'Top Rank',
          'Headline',
          'Catalog',
          'Bureau',
          'Day Views',
          'Week Views',
          'Month Views',
          'Annual Views',
          'All-Time Views'
        ]),
        ...(freshAnalytics.topArticles ?? []).map((story, idx) =>
          toCsvRow([
            idx + 1,
            story.title,
            story.category,
            story.bureau,
            story.dayViews,
            story.weekViews,
            story.monthViews,
            story.annualViews,
            story.totalViews
          ])
        )
      ];

      const csvContent = `\uFEFF${csvLines.join('\r\n')}`;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `newshub24plus-analytics-${timeframe}-${dateStamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      setExportStatus({
        type: 'success',
        text: `Downloaded live analytics CSV (${freshAnalytics.byCatalog.length} catalogs, ${freshAnalytics.topArticles.length} top dispatches).`
      });
    } catch (error) {
      setExportStatus({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to export analytics CSV.'
      });
    } finally {
      setExportingCsv(false);
    }
  };

  const handleOpenTopStory = (articleId: string) => {
    const matched = articles.find((a) => a.id === articleId);
    if (matched) {
      onSelectArticle(matched);
    }
  };

  return (
    <section
      id="analytics"
      className="border-t border-[#E5E2DC] dark:border-[#2C2A26] bg-[#FBF9F5] dark:bg-[#0D0D0C]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-20">
        {/* Header & Timeframe Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] mb-1.5 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Audience Telemetry &amp; Catalog Reach</span>
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#141413] dark:text-[#F5F3EE] mb-2">
              Content Performance Dashboard
            </h2>
            <p className="text-sm sm:text-base text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">
              Verified reader views tracked across daily, weekly, monthly, and annual horizons across every News Hub 24+.com catalog and Base44 dispatch.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              role="tablist"
              aria-label="Select performance reporting period"
              className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#F5F2EB] dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md"
            >
              {(['day', 'week', 'month', 'annual'] as AnalyticsTimeframe[]).map((frame) => {
                const active = timeframe === frame;
                return (
                  <button
                    key={frame}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setTimeframe(frame);
                      setSelectedBarIdx(null);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] shadow-xs font-semibold'
                        : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
                    }`}
                  >
                    {TIMEFRAME_LABELS[frame].tab}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => void handleExportCsv()}
              disabled={exportingCsv}
              aria-label="Export Analytics as CSV"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#171715] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#141413] dark:hover:border-[#F5F3EE] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#991B1B] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{exportingCsv ? 'Exporting Analytics…' : 'Export Analytics as CSV'}</span>
            </button>
          </div>
        </div>

        {exportStatus && (
          <div
            role="status"
            aria-live="polite"
            className={`mt-4 px-4 py-2.5 rounded-md border text-xs flex items-center justify-between gap-3 ${
              exportStatus.type === 'success'
                ? 'bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534] text-[#14532D] dark:text-[#86EFAC]'
                : 'bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D] text-[#991B1B] dark:text-[#FCA5A5]'
            }`}
          >
            <span>{exportStatus.text}</span>
            <button
              type="button"
              onClick={() => setExportStatus(null)}
              className="font-semibold underline underline-offset-2 whitespace-nowrap shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 4-Column Horizon Summary Cards (Day, Week, Month, Annual) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 py-8">
          {(
            [
              { key: 'day', label: 'Daily Views (24h)', value: analytics?.summary.day ?? 0, note: '+14.2% vs prior day' },
              { key: 'week', label: 'Weekly Views (7d)', value: analytics?.summary.week ?? 0, note: '+18.6% vs prior week' },
              { key: 'month', label: 'Monthly Views (30d)', value: analytics?.summary.month ?? 0, note: '+22.4% vs prior 30d' },
              { key: 'annual', label: 'Annual Views (12m)', value: analytics?.summary.annual ?? 0, note: '12-month cumulative' }
            ] as const
          ).map((card) => {
            const isSelected = timeframe === card.key;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => {
                  setTimeframe(card.key);
                  setSelectedBarIdx(null);
                }}
                className={`text-left p-5 rounded-md border transition-colors ${
                  isSelected
                    ? 'bg-white dark:bg-[#1C1B19] border-[#141413] dark:border-[#F5F3EE]'
                    : 'bg-white dark:bg-[#171715] border-[#E5E2DC] dark:border-[#2C2A26] hover:border-[#A8A29E] dark:hover:border-[#57534E]'
                }`}
              >
                <span className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                  {card.label}
                </span>
                {loading && !analytics ? (
                  <div className="h-9 w-28 bg-[#E5E2DC] dark:bg-[#2C2A26] rounded-sm animate-pulse mb-1.5" />
                ) : (
                  <span className="block font-serif text-2xl sm:text-3xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums mb-1">
                    {card.value.toLocaleString()}
                  </span>
                )}
                <span
                  className={`block text-xs font-mono tabular-nums ${
                    isSelected
                      ? 'text-[#991B1B] dark:text-[#F87171] font-semibold'
                      : 'text-[#14532D] dark:text-[#4ADE80]'
                  }`}
                >
                  {isSelected ? 'Active Horizon' : card.note}
                </span>
              </button>
            );
          })}
        </div>

        {/* Bar Chart Panel */}
        <div className="p-6 sm:p-8 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 mb-6 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
            <div>
              <h3 className="font-serif text-xl sm:text-2xl font-semibold text-[#141413] dark:text-[#F5F3EE]">
                {TIMEFRAME_LABELS[timeframe].title}
              </h3>
              <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                {TIMEFRAME_LABELS[timeframe].subtitle} · {analytics?.totalArticles ?? articles.length} tracked stories
              </p>
            </div>

            {activePoint && (
              <div className="text-left sm:text-right">
                <span className="block text-xs text-[#57534E] dark:text-[#A8A29E]">
                  Selected Interval ({activePoint.label})
                </span>
                <span className="font-mono text-lg font-semibold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                  {activePoint.views.toLocaleString()} views
                </span>
              </div>
            )}
          </div>

          {loading && !analytics ? (
            <div className="h-56 w-full bg-[#F5F2EB] dark:bg-[#1C1B19] rounded-md animate-pulse" />
          ) : (
            <div
              className="grid gap-2 sm:gap-3 items-end h-56 pt-6"
              style={{ gridTemplateColumns: `repeat(${Math.max(activeSeries.length, 1)}, minmax(0, 1fr))` }}
            >
              {activeSeries.map((point, idx) => {
                const heightPct = Math.max(8, Math.round((point.views / maxBarValue) * 100));
                const isLatest = idx === activeSeries.length - 1;
                const isFocused = selectedBarIdx === idx || (selectedBarIdx === null && isLatest);

                return (
                  <button
                    key={point.label}
                    type="button"
                    onClick={() => setSelectedBarIdx(idx)}
                    onMouseEnter={() => setSelectedBarIdx(idx)}
                    className="group flex flex-col items-center justify-end h-full focus:outline-none"
                    aria-label={`${point.label}: ${point.views.toLocaleString()} views`}
                  >
                    <span className="font-mono text-[10px] sm:text-[11px] text-[#57534E] dark:text-[#A8A29E] tabular-nums mb-1.5 opacity-80 group-hover:opacity-100">
                      {point.views >= 10000
                        ? `${(point.views / 1000).toFixed(0)}k`
                        : point.views >= 1000
                          ? `${(point.views / 1000).toFixed(1)}k`
                          : point.views}
                    </span>
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className={`w-full rounded-t-sm transition-opacity duration-150 ${
                          isFocused
                            ? 'bg-[#991B1B] dark:bg-[#DC2626]'
                            : 'bg-[#141413]/80 dark:bg-[#E5E2DC]/75 group-hover:bg-[#991B1B]/80 dark:group-hover:bg-[#F87171]'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span
                      className={`mt-2 font-mono text-[10px] sm:text-xs tabular-nums truncate max-w-full ${
                        isFocused
                          ? 'font-semibold text-[#141413] dark:text-[#F5F3EE]'
                          : 'text-[#57534E] dark:text-[#A8A29E]'
                      }`}
                    >
                      {point.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* D3.js 30-Day Daily Verified Revenue USD vs. Watch Time Trends */}
        <D3RevenueWatchTrendChart externalRefreshKey={trendsRefreshKey} />

        {/* Two-Column Breakdown: Catalog Matrix + Top Performing Dispatches */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Catalog Performance Table */}
          <div className="lg:col-span-6 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
            <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between gap-2">
              <h3 className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                Catalog Performance Breakdown
              </h3>
              <span className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E]">
                Day / Week / Month / Year
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#E5E2DC] dark:border-[#2C2A26] text-[#57534E] dark:text-[#A8A29E]">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Catalog</th>
                    <th className="py-2.5 px-3 font-medium text-right">Day</th>
                    <th className="py-2.5 px-3 font-medium text-right">Week</th>
                    <th className="py-2.5 px-3 font-medium text-right">Month</th>
                    <th className="py-2.5 px-4 font-medium text-right">Annual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
                  {(analytics?.byCatalog ?? []).map((row) => (
                    <tr
                      key={row.catalog}
                      className="hover:bg-[#FBF9F5] dark:hover:bg-[#1F1E1B] transition-colors"
                    >
                      <td className="py-2.5 px-4 font-medium text-[#141413] dark:text-[#F5F3EE] whitespace-nowrap">
                        {row.catalog}
                        <span className="ml-1.5 font-mono text-[11px] text-[#78716C] dark:text-[#A8A29E] tabular-nums">
                          ({row.storyCount})
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#44403C] dark:text-[#D6D3CD]">
                        {row.dayViews.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#44403C] dark:text-[#D6D3CD]">
                        {row.weekViews.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#44403C] dark:text-[#D6D3CD]">
                        {row.monthViews.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold tabular-nums text-[#141413] dark:text-[#F5F3EE]">
                        {row.annualViews.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Stories Leaderboard */}
          <div className="lg:col-span-6 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
            <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between gap-2">
              <h3 className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                Top Performing Dispatches ({TIMEFRAME_LABELS[timeframe].tab})
              </h3>
              <span className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E]">
                Click story to inspect
              </span>
            </div>

            <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
              {(analytics?.topArticles ?? []).slice(0, 8).map((story, idx) => (
                <div
                  key={story.id}
                  className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#FBF9F5] dark:hover:bg-[#1F1E1B] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] text-[#57534E] dark:text-[#A8A29E] mb-0.5">
                      <span className="font-mono tabular-nums">{String(idx + 1).padStart(2, '0')}.</span>
                      <span className="font-semibold text-[#991B1B] dark:text-[#F87171]">{story.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{story.bureau}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenTopStory(story.id)}
                      className="text-left text-xs sm:text-sm font-serif font-semibold text-[#141413] dark:text-[#F5F3EE] hover:text-[#991B1B] dark:hover:text-[#F87171] transition-colors line-clamp-1"
                    >
                      {story.title}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenTopStory(story.id)}
                    className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] tabular-nums whitespace-nowrap shrink-0 hover:text-[#991B1B] dark:hover:text-[#F87171]"
                  >
                    <span>{getViewsForFrame(story, timeframe).toLocaleString()}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
