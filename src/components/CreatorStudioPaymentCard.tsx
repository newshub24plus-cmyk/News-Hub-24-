import { CheckCircle2, Coins, RefreshCw, Smartphone, Sparkles, Star, Tv } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { NewsArticle } from '../data/newsData';
import type { AfricaFxRates, MonetizationSummary, MonetizationTransaction } from './PaymentModal';

interface CreatorStudioPaymentOption {
  rank: number;
  id: 'ghana-pay' | 'global-rail' | 'newshub-app-wallet' | string;
  title: string;
  subtitle: string;
  ready: boolean;
}

interface CreatorStudioResponse {
  generatedAt: string;
  fxRates: AfricaFxRates;
  partnerEligibility: {
    watchHoursCurrent: number;
    watchHoursGoal: number;
    subscribersCurrent: number;
    subscribersGoal: number;
    youtubeStyleQualified: boolean;
    facebookStarsEnabled: boolean;
    payoutThresholdUsd: number;
    creatorSharePercent: number;
  };
  streams: {
    channelMembershipsMrrUsd: number;
    inStreamVideoAdsUsd: number;
    superThanksAndStarsUsd: number;
    totalStarsCount: number;
    verifiedRealUsd: number;
  };
  threePaymentOptions: CreatorStudioPaymentOption[];
  recentSupportTxs: MonetizationTransaction[];
}

interface CreatorStudioPaymentCardProps {
  articles?: NewsArticle[];
  externalRefreshKey?: number;
  onSupportSuccess?: (payload: {
    transaction: MonetizationTransaction;
    summary: MonetizationSummary;
    recentTransactions: MonetizationTransaction[];
    revenueEngine?: unknown;
    message: string;
  }) => void;
}

const STAR_PACKS = [
  { usd: 2, stars: 200, label: '200 Stars / $2' },
  { usd: 5, stars: 500, label: '500 Stars / $5' },
  { usd: 10, stars: 1000, label: '1,000 Stars / $10' },
  { usd: 25, stars: 2500, label: '2,500 Stars / $25' },
  { usd: 50, stars: 5000, label: '5,000 Stars / $50' }
] as const;

export function CreatorStudioPaymentCard({
  articles = [],
  externalRefreshKey = 0,
  onSupportSuccess
}: CreatorStudioPaymentCardProps) {
  const [studio, setStudio] = useState<CreatorStudioResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [supportType, setSupportType] = useState<'youtube_super_thanks' | 'facebook_stars'>('facebook_stars');
  const [selectedPackUsd, setSelectedPackUsd] = useState<number>(5);
  const [paymentOption, setPaymentOption] = useState<'ghana-pay' | 'global-rail' | 'newshub-app-wallet'>(
    'newshub-app-wallet'
  );
  const [targetTitle, setTargetTitle] = useState<string>('');
  const [supporterName, setSupporterName] = useState<string>('');
  const [supporterEmail, setSupporterEmail] = useState<string>('');
  const [messageNote, setMessageNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadStudio = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/monetization/creator-studio');
      if (res.ok) {
        const json = (await res.json()) as CreatorStudioResponse;
        setStudio(json);
      }
    } catch {
      // Preserve last fetched state cleanly
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStudio();
  }, [loadStudio, externalRefreshKey]);

  useEffect(() => {
    if (!targetTitle && articles.length > 0) {
      setTargetTitle(articles[0].title);
    }
  }, [articles, targetTitle]);

  const fxGhs = studio?.fxRates?.GHS ?? 15.5;
  const watchHoursCurrent = studio?.partnerEligibility.watchHoursCurrent ?? 0;
  const watchHoursGoal = studio?.partnerEligibility.watchHoursGoal ?? 4000;
  const watchPercent = Math.min(100, Math.round((watchHoursCurrent / Math.max(1, watchHoursGoal)) * 100));

  const subsCurrent = studio?.partnerEligibility.subscribersCurrent ?? 0;
  const subsGoal = studio?.partnerEligibility.subscribersGoal ?? 1000;
  const subsPercent = Math.min(100, Math.round((subsCurrent / Math.max(1, subsGoal)) * 100));

  const mapServerOptionToKey = (
    opt: CreatorStudioPaymentOption
  ): 'ghana-pay' | 'global-rail' | 'newshub-app-wallet' => {
    if (opt.rank === 3 || opt.id === 'newshub-app-wallet') return 'newshub-app-wallet';
    if (opt.rank === 1 || opt.id === 'ghana-pay') return 'ghana-pay';
    return 'global-rail';
  };

  const handleSubmitSupport = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (supporterName.trim().length < 2) {
      setFeedback({ type: 'error', text: 'Enter your reader or supporter name (2+ characters).' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/monetization/creator-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supportType,
          targetTitle: targetTitle.trim() || 'News Hub 24+ Creator Studio',
          amountUsd: selectedPackUsd,
          starsCount: selectedPackUsd * 100,
          paymentOption,
          supporterName: supporterName.trim(),
          supporterEmail: supporterEmail.trim() || undefined,
          messageNote: messageNote.trim() || undefined
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not process Super Thanks / Stars support.');
      }

      setFeedback({ type: 'success', text: payload.message as string });
      setMessageNote('');
      onSupportSuccess?.(payload);
      await loadStudio();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to send creator support.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedStars = selectedPackUsd * 100;

  return (
    <div className="p-6 sm:p-8 bg-[#FBF9F5] dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
        <div>
          <p className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] mb-1 flex items-center gap-1.5">
            <Tv className="w-3.5 h-3.5" />
            <span>YouTube Partner &amp; Facebook Creator Payment System · 3 Payment Options</span>
          </p>
          <h3 className="font-serif text-2xl font-bold text-[#141413] dark:text-[#F5F3EE]">
            Creator Studio: Super Thanks, Stars, Memberships &amp; App Wallet
          </h3>
          <p className="text-xs sm:text-sm text-[#57534E] dark:text-[#A8A29E] mt-1">
            Monetize video watch hours, In-Stream ads (70% creator share), Channel Memberships, Facebook-style Stars, and YouTube-style Super Thanks — with the News Hub 24+ App Wallet enabled as the 3rd payment option.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => void loadStudio()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#141413] disabled:opacity-50 self-start shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync Creator Studio</span>
        </button>
      </div>

      {/* Partner Program Eligibility & 4 Stream KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 p-5 bg-white dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-4">
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#E5E2DC] dark:border-[#2C2A26] text-xs">
            <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
              Partner Program Eligibility (YouTube / Meta Model)
            </span>
            <span className="font-mono text-[11px] font-semibold text-[#14532D] dark:text-[#4ADE80]">
              {studio?.partnerEligibility.creatorSharePercent ?? 70}% Creator Share
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[#44403C] dark:text-[#D6D3CD]">Public Video Watch Hours</span>
                <span className="font-mono font-semibold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                  {watchHoursCurrent.toLocaleString()} / {watchHoursGoal.toLocaleString()} hrs ({watchPercent}%)
                </span>
              </div>
              <svg
                viewBox="0 0 100 6"
                preserveAspectRatio="none"
                role="progressbar"
                aria-valuenow={watchPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Public video watch hours progress"
                className="w-full h-2 rounded-xs bg-[#EFECE5] dark:bg-[#242320]"
              >
                <rect
                  x={0}
                  y={0}
                  width={Math.max(2, watchPercent)}
                  height={6}
                  rx={1}
                  className="fill-[#991B1B] dark:fill-[#DC2626]"
                />
              </svg>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[#44403C] dark:text-[#D6D3CD]">Channel Subscribers &amp; Members</span>
                <span className="font-mono font-semibold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                  {subsCurrent.toLocaleString()} / {subsGoal.toLocaleString()} ({subsPercent}%)
                </span>
              </div>
              <svg
                viewBox="0 0 100 6"
                preserveAspectRatio="none"
                role="progressbar"
                aria-valuenow={subsPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Channel subscribers progress"
                className="w-full h-2 rounded-xs bg-[#EFECE5] dark:bg-[#242320]"
              >
                <rect
                  x={0}
                  y={0}
                  width={Math.max(2, subsPercent)}
                  height={6}
                  rx={1}
                  className="fill-[#14532D] dark:fill-[#16A34A]"
                />
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#E5E2DC] dark:border-[#2C2A26] text-xs">
            <div>
              <span className="text-[#57534E] dark:text-[#A8A29E] block">Memberships MRR</span>
              <span className="font-mono text-base font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                ${(studio?.streams.channelMembershipsMrrUsd ?? 0).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[#57534E] dark:text-[#A8A29E] block">In-Stream &amp; Ad Revenue</span>
              <span className="font-mono text-base font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                ${(studio?.streams.inStreamVideoAdsUsd ?? 0).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[#57534E] dark:text-[#A8A29E] block">Super Thanks &amp; Stars</span>
              <span className="font-mono text-base font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                ${(studio?.streams.superThanksAndStarsUsd ?? 0).toFixed(2)} ({(studio?.streams.totalStarsCount ?? 0).toLocaleString()}★)
              </span>
            </div>
            <div>
              <span className="text-[#57534E] dark:text-[#A8A29E] block">Verified Real External</span>
              <span className="font-mono text-base font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                ${(studio?.streams.verifiedRealUsd ?? 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Right 7 Cols: 3 Payment Options (App = 3rd Option) + Send Super Thanks / Stars */}
        <div className="lg:col-span-7 p-5 bg-white dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-5">
          {/* Mode Switch + 3 Payment Options Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
              <Star className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
              <span>Send Creator Support · Choose 1 of 3 Payment Options</span>
            </div>

            <div
              role="tablist"
              aria-label="Creator support format"
              className="inline-flex items-center gap-1 p-1 bg-[#F5F2EB] dark:bg-[#0D0D0C] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md"
            >
              <button
                type="button"
                role="tab"
                aria-selected={supportType === 'facebook_stars'}
                onClick={() => setSupportType('facebook_stars')}
                className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                  supportType === 'facebook_stars'
                    ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] font-semibold'
                    : 'text-[#57534E] dark:text-[#A8A29E]'
                }`}
              >
                Facebook Stars
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={supportType === 'youtube_super_thanks'}
                onClick={() => setSupportType('youtube_super_thanks')}
                className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                  supportType === 'youtube_super_thanks'
                    ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] font-semibold'
                    : 'text-[#57534E] dark:text-[#A8A29E]'
                }`}
              >
                YouTube Super Thanks
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmitSupport} noValidate className="space-y-4 text-xs">
            {/* 3 Payment Options Grid (App Wallet = 3rd Option) */}
            <div>
              <span className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-2">
                Select Payment Option (App Wallet Available as 3rd Option)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {(studio?.threePaymentOptions ?? [
                  {
                    rank: 1,
                    id: 'ghana-pay',
                    title: 'Option 1 · GhanaPay & MTN MoMo (0557711975)',
                    subtitle: 'Direct GH₵ Mobile Money & Third-Party',
                    ready: true
                  },
                  {
                    rank: 2,
                    id: 'global-rail',
                    title: 'Option 2 · Card, PayPal & Flutterwave',
                    subtitle: 'Global YouTube / Meta Billing Rails',
                    ready: false
                  },
                  {
                    rank: 3,
                    id: 'newshub-app-wallet',
                    title: 'Option 3 · News Hub 24+ App Wallet',
                    subtitle: 'In-App APK / Base44 Wallet · $0 Fee',
                    ready: true
                  }
                ]).map((opt) => {
                  const key = mapServerOptionToKey(opt);
                  const active = paymentOption === key;
                  const isThirdAppOption = key === 'newshub-app-wallet';
                  return (
                    <button
                      key={opt.title}
                      type="button"
                      onClick={() => setPaymentOption(key)}
                      className={`p-3 text-left rounded-md border transition-colors flex flex-col justify-between gap-1.5 ${
                        active
                          ? 'bg-[#FBF9F5] dark:bg-[#1C1B19] border-[#991B1B] dark:border-[#F87171]'
                          : 'bg-white dark:bg-[#10100F] border-[#E5E2DC] dark:border-[#2C2A26] hover:border-[#A8A29E]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[11px] font-semibold text-[#991B1B] dark:text-[#F87171]">
                          {isThirdAppOption ? 'Option 3 · The App' : `Option ${opt.rank}`}
                        </span>
                        {isThirdAppOption ? (
                          <Smartphone className="w-3.5 h-3.5 text-[#14532D] dark:text-[#4ADE80]" />
                        ) : (
                          <Coins className="w-3.5 h-3.5 text-[#57534E] dark:text-[#A8A29E]" />
                        )}
                      </div>
                      <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] leading-snug">
                        {opt.title.replace(/^Option \d+\s*·\s*/, '')}
                      </span>
                      <span className="text-[11px] text-[#57534E] dark:text-[#A8A29E] leading-tight">
                        {opt.subtitle}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stars / Super Thanks Pack Picker */}
            <div>
              <span className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1.5">
                {supportType === 'facebook_stars'
                  ? `Choose Stars Pack (≈ GH₵ ${(selectedPackUsd * fxGhs).toFixed(2)})`
                  : `Choose Super Thanks Amount (≈ GH₵ ${(selectedPackUsd * fxGhs).toFixed(2)})`}
              </span>
              <div className="flex flex-wrap gap-2">
                {STAR_PACKS.map((pack) => {
                  const active = selectedPackUsd === pack.usd;
                  return (
                    <button
                      key={pack.usd}
                      type="button"
                      onClick={() => setSelectedPackUsd(pack.usd)}
                      className={`px-3 py-1.5 font-mono text-xs font-semibold rounded-sm border transition-colors tabular-nums ${
                        active
                          ? 'bg-[#141413] text-white border-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] dark:border-[#F5F3EE]'
                          : 'bg-[#FBF9F5] dark:bg-[#10100F] text-[#141413] dark:text-[#F5F3EE] border-[#D6D1C7] dark:border-[#3A3732] hover:border-[#141413]'
                      }`}
                    >
                      {supportType === 'facebook_stars' ? pack.label : `$${pack.usd} Super Thanks`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dispatch Target + Supporter Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="creator-target-dispatch" className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Supported Dispatch / Video
                </label>
                {articles.length > 0 ? (
                  <select
                    id="creator-target-dispatch"
                    value={targetTitle}
                    onChange={(e) => setTargetTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                  >
                    {articles.slice(0, 10).map((a) => (
                      <option key={a.id} value={a.title}>
                        {a.title}
                      </option>
                    ))}
                    <option value="News Hub 24+ Creator Studio">News Hub 24+ Creator Studio</option>
                  </select>
                ) : (
                  <input
                    id="creator-target-dispatch"
                    type="text"
                    value={targetTitle}
                    onChange={(e) => setTargetTitle(e.target.value)}
                    placeholder="News Hub 24+ Creator Studio"
                    className="w-full px-3 py-2 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                  />
                )}
              </div>

              <div>
                <label htmlFor="creator-supporter-name" className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Supporter Name
                </label>
                <input
                  id="creator-supporter-name"
                  type="text"
                  required
                  value={supporterName}
                  onChange={(e) => setSupporterName(e.target.value)}
                  placeholder="e.g. Kwame Boateng"
                  className="w-full px-3 py-2 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>

              <div>
                <label htmlFor="creator-supporter-email" className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Receipt Email (Optional)
                </label>
                <input
                  id="creator-supporter-email"
                  type="email"
                  value={supporterEmail}
                  onChange={(e) => setSupporterEmail(e.target.value)}
                  placeholder="supporter@example.com"
                  className="w-full px-3 py-2 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>

              <div>
                <label htmlFor="creator-support-note" className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Comment / Shoutout Note
                </label>
                <input
                  id="creator-support-note"
                  type="text"
                  value={messageNote}
                  onChange={(e) => setMessageNote(e.target.value)}
                  placeholder="Keep up the investigative reporting!"
                  className="w-full px-3 py-2 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>
            </div>

            {feedback && (
              <div
                role="status"
                className={`p-3 rounded-md border flex items-start gap-2 ${
                  feedback.type === 'success'
                    ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                    : 'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{feedback.text}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E5E2DC] dark:border-[#2C2A26]">
              <span className="text-[11px] text-[#57534E] dark:text-[#A8A29E] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
                <span>
                  {paymentOption === 'newshub-app-wallet'
                    ? '3rd Option: Instant News Hub 24+ App Wallet credit ($0 gateway fee · In-app ledger)'
                    : paymentOption === 'ghana-pay'
                      ? 'Option 1: GhanaPay / MTN MoMo ledger settlement'
                      : 'Option 2: Global Card / PayPal Hub sandbox settlement'}
                </span>
              </span>

              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-md disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {submitting
                  ? 'Crediting Creator…'
                  : supportType === 'facebook_stars'
                    ? `Send ${selectedStars.toLocaleString()} Stars ($${selectedPackUsd})`
                    : `Send $${selectedPackUsd} Super Thanks`}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Recent Super Thanks & Stars Support Log */}
      {(studio?.recentSupportTxs?.length ?? 0) > 0 && (
        <div className="bg-white dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
          <div className="px-4 py-3 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between text-xs">
            <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
              Recent Super Thanks &amp; Stars Ledger
            </span>
            <span className="font-mono text-[#57534E] dark:text-[#A8A29E] tabular-nums">
              {studio?.recentSupportTxs.length ?? 0} entries
            </span>
          </div>
          <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
            {studio?.recentSupportTxs.slice(0, 5).map((tx) => (
              <div
                key={tx.id}
                className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] block truncate">
                    {tx.customerName} · {tx.planName}
                  </span>
                  <span className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] block truncate">
                    {tx.id} · {tx.paymentMethodName} · {tx.accountHint}
                  </span>
                </div>
                <div className="sm:text-right font-mono tabular-nums shrink-0">
                  <span className="font-semibold text-[#14532D] dark:text-[#4ADE80] block">
                    +${tx.amountUsd.toFixed(2)} USD
                  </span>
                  <span className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                    {tx.verifiedRealFunds ? 'Verified Live Rail' : 'In-App / Sandbox'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
