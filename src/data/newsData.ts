export type NewsCategory =
  | 'All'
  | 'World'
  | 'Politics'
  | 'Sports'
  | 'Entertainment'
  | 'Black History'
  | 'Movie Snippets'
  | 'Comic Series'
  | 'Commercials & Ads'
  | 'Economy'
  | 'Climate'
  | 'Technology'
  | 'Investigations';

export const ARTICLE_CATALOGS: Array<Exclude<NewsCategory, 'All'>> = [
  'World',
  'Politics',
  'Sports',
  'Entertainment',
  'Black History',
  'Movie Snippets',
  'Comic Series',
  'Commercials & Ads',
  'Economy',
  'Climate',
  'Technology',
  'Investigations'
];

export type ImageKey =
  | 'hero_lead_summit'
  | 'feature_global_trade'
  | 'feature_energy_grid'
  | 'feature_quantum_lab'
  | 'apk_mobile_showcase';

export interface NewsArticle {
  id: string;
  slug: string;
  category: Exclude<NewsCategory, 'All'>;
  tier: 'lead' | 'featured' | 'wire';
  breaking?: boolean;
  isUserPublished?: boolean;
  isAiGenerated?: boolean;
  regionFocus?: 'Global' | 'Europe' | 'Asia' | 'Europe & Asia';
  sourceLinks?: Array<{ title: string; uri: string }>;
  views: number;
  kicker: string;
  title: string;
  deck: string;
  author: string;
  authorRole: string;
  bureau: string;
  publishedAt: string;
  displayDate: string;
  readTime: string;
  imageKey?: ImageKey;
  figureCaption?: string;
  pullQuote?: string;
  paragraphs: string[];
}

export const NEWS_ARTICLES: NewsArticle[] = [
  {
    id: 'nh24-001',
    slug: 'geneva-accord-digital-trade-tariff-framework',
    category: 'World',
    tier: 'lead',
    breaking: true,
    views: 4820,
    kicker: 'Geneva Diplomatic Dispatch',
    title: 'Geneva Accord Establishes Binding Cross-Border Digital Trade and Tariff Framework',
    deck: 'Negotiators from 38 economies ratify unified customs telemetry and zero-duty rules for cross-border journalism, cloud computing, and scientific data flows.',
    author: 'Elena Rostova',
    authorRole: 'Chief Diplomatic Correspondent',
    bureau: 'Geneva Bureau',
    publishedAt: '2026-11-13T05:40:00Z',
    displayDate: 'Nov 13, 2026 · 05:40 UTC',
    readTime: '6 min read',
    imageKey: 'hero_lead_summit',
    figureCaption: 'Delegates convene at the Palais Assembly Hall in Geneva ahead of the final plenary vote on Friday morning.',
    pullQuote: 'For the first time in a decade, trade ministers treated cross-border public reporting and scientific datasets as protected civic infrastructure.',
    paragraphs: [
      'GENEVA — Trade representatives from thirty-eight nations signed a landmark multilateral framework early Friday, eliminating customs tariffs on cross-border digital transmissions and establishing verifiable provenance standards for international news wire syndication.',
      'The agreement concludes fourteen months of closed-door technical sessions led by European, Asia-Pacific, and Latin American delegations. Under the new rules, signatory customs authorities must adopt open-schema manifests that clear physical media equipment and satellite broadcast kits within four hours of port arrival.',
      'Independent media consortia welcomed the inclusion of Article 14, which explicitly bars signatory governments from imposing retroactive bandwidth levies on foreign news bureaus or blocking encrypted press-wire relays during municipal elections.',
      'Implementation begins in January 2027, overseen by a rotating compliance panel headquartered in Geneva and Singapore. Economic ministries project the streamlined customs corridor will cut operational overhead for international broadcasters and research institutions by nearly eighteen percent over three fiscal years.'
    ]
  },
  {
    id: 'nh24-002',
    slug: 'maritime-port-automation-cuts-turnaround',
    category: 'Economy',
    tier: 'featured',
    breaking: true,
    views: 3190,
    kicker: 'Global Supply Chain',
    title: 'Maritime Logistics Shift as Port Automation Cuts Vessel Turnaround Times by 31%',
    deck: 'Deep-water terminals in Rotterdam, Busan, and Halifax report sustained berth efficiency gains following coordinated rail-to-crane scheduling.',
    author: 'Marcus Vance',
    authorRole: 'Senior Maritime & Trade Editor',
    bureau: 'Rotterdam Desk',
    publishedAt: '2026-11-13T04:15:00Z',
    displayDate: 'Nov 13, 2026 · 04:15 UTC',
    readTime: '5 min read',
    imageKey: 'feature_global_trade',
    figureCaption: 'Automated gantry cranes operate along Berth 7 at Rotterdam Europort shortly before sunrise.',
    pullQuote: 'Cutting idle anchorage hours reduces bunker fuel burn before a single container even touches the rail spur.',
    paragraphs: [
      'ROTTERDAM — Major deep-water container terminals across Northern Europe and East Asia have recorded a thirty-one percent reduction in average vessel turnaround times compared with fourth-quarter baselines two years ago, according to port authority audit figures released Friday.',
      'The gains stem less from heavier crane hardware than from synchronized slot-allocation telemetry shared between shipping lines, harbor pilots, and inland freight rail operators. When incoming vessels adjust cruising speeds seventy-two hours out, berth queues flatten and diesel idling drops sharply.',
      'Dockworker unions and port operators finalized a joint retraining compact alongside the rollout, shifting crane operators into remote exception-handling control rooms with fixed shift schedules and hazard pay protections.',
      'Freight economists caution that inland barge bottlenecks along low-water river corridors remain a vulnerability heading into winter, though automated yard stacking has absorbed short-term container surges without triggering demurrage surcharges.'
    ]
  },
  {
    id: 'nh24-003',
    slug: 'north-sea-hybrid-wind-solar-interconnector',
    category: 'Climate',
    tier: 'featured',
    views: 2640,
    kicker: 'Energy Infrastructure',
    title: 'North Sea Hybrid Wind-Solar Interconnector Reaches 4.2 Gigawatt Peak Output',
    deck: 'Engineers validate dual-direction subsea HVDC balancing across coastal arrays during late-autumn Atlantic squalls.',
    author: 'Henrik Lindqvist',
    authorRole: 'Energy & Climate Correspondent',
    bureau: 'Aberdeen Field Unit',
    publishedAt: '2026-11-13T02:50:00Z',
    displayDate: 'Nov 13, 2026 · 02:50 UTC',
    readTime: '4 min read',
    imageKey: 'feature_energy_grid',
    figureCaption: 'Field engineers inspect subsea telemetry junction boxes overlooking the coastal hybrid generation basin.',
    pullQuote: 'Pairing coastal solar troughs with North Atlantic wind corridors narrows the evening ramp gap across three national grids.',
    paragraphs: [
      'ABERDEEN — Grid operators confirmed Friday that the North Sea hybrid wind-and-solar interconnector sustained a peak transfer load of 4.2 gigawatts for nine consecutive hours, marking the highest verified clean-power dispatch in the corridor’s history.',
      'Unlike legacy offshore wind farms that curtail generation when regional demand dips, the high-voltage direct-current link routes surplus coastal electricity automatically toward industrial battery parks in northern Germany and pumped-hydro reservoirs in western Norway.',
      'Field technicians spent the past six weeks recalibrating protective relays along exposed highland collector stations to withstand winter salt spray and rapid voltage swings.',
      'Regulators expect two additional converter stations to enter commercial service by mid-2027, adding enough reserve capacity to retire three remaining coal-fired peaking units ahead of schedule.'
    ]
  },
  {
    id: 'nh24-004',
    slug: 'quantum-metrology-room-temperature-timing-chips',
    category: 'Technology',
    tier: 'featured',
    views: 2180,
    kicker: 'Science & Semiconductors',
    title: 'European Quantum Metrology Consortium Demonstrates Room-Temperature Timing Chips',
    deck: 'Compact diamond-lattice resonators achieve atomic-grade clock stability without bulky cryogenic cooling racks.',
    author: 'Dr. Amara Okafor',
    authorRole: 'Science & Technology Editor',
    bureau: 'Zurich Science Desk',
    publishedAt: '2026-11-12T22:10:00Z',
    displayDate: 'Nov 12, 2026 · 22:10 UTC',
    readTime: '5 min read',
    imageKey: 'feature_quantum_lab',
    figureCaption: 'Researchers verify vacuum chamber alignment inside the Zurich metrology cleanroom prior to drift testing.',
    pullQuote: 'Bringing microsecond-free timing stability onto a standard circuit board changes how telecommunications networks survive GPS outages.',
    paragraphs: [
      'ZURICH — A consortium of university physicists and semiconductor foundries unveiled a wafer-scale timing oscillator on Thursday capable of maintaining sub-nanosecond clock drift at ambient room temperature.',
      'Historically, ultra-precise frequency references required vacuum atomic chambers or liquid-helium cryostats confined to national standards laboratories. By etching synthetic nitrogen-vacancy diamond waveguides directly onto silicon photonics substrates, researchers shrank the core assembly to the size of a postage stamp.',
      'Telecommunications carriers and subsea cable operators are testing early engineering samples as backup synchronization anchors in regions prone to satellite navigation interference.',
      'Commercial pilot fabrication begins in Dresden next spring, with initial units earmarked for power-grid phasor measurement and financial timestamping hubs.'
    ]
  },
  {
    id: 'nh24-005',
    slug: 'subsea-financial-telemetry-shadow-cable-investigation',
    category: 'Investigations',
    tier: 'wire',
    views: 1945,
    kicker: 'Special Investigation',
    title: 'Inside the Uncharted Maintenance Routes Carrying High-Frequency Subsea Telemetry',
    deck: 'A six-month News Hub 24+ review of maritime transponder logs reveals aging repeater stations operating without public audit.',
    author: 'Claire Beaumont & Tariq Al-Mansoor',
    authorRole: 'Investigative Desk',
    bureau: 'London & Marseille',
    publishedAt: '2026-11-12T18:30:00Z',
    displayDate: 'Nov 12, 2026 · 18:30 UTC',
    readTime: '8 min read',
    pullQuote: 'More than ninety-seven percent of intercontinental financial clearing and news wire traffic still travels beneath the ocean floor.',
    paragraphs: [
      'LONDON — Over six months of cross-referencing hydrographic repair notices with public vessel automatic identification logs, News Hub 24+ identified fourteen critical subsea fiber corridors operating with single-point landing vulnerabilities.',
      'While hyperscale cloud operators have funded newer transoceanic trunks, regional landing stations built in the late 1990s still funnel municipal banking, emergency dispatch, and public broadcast feeds through narrow coastal choke points.',
      'Maritime insurers interviewed for this investigation warned that specialized cable-repair vessels remain in short supply globally, with average dispatch lead times exceeding eleven days during peak storm seasons.',
      'Parliamentary committees in two coastal states have requested mandatory redundancy disclosures from consortium operators following the findings.'
    ]
  },
  {
    id: 'nh24-006',
    slug: 'central-banks-liquidity-buffers-q1-treasury',
    category: 'Economy',
    tier: 'wire',
    views: 1420,
    kicker: 'Monetary Policy',
    title: 'Central Banks Coordinate Standing Liquidity Buffers Ahead of Q1 Treasury Issuance',
    deck: 'Joint repo facility adjustments aim to prevent short-term money market rate spikes during heavy sovereign debt auctions.',
    author: 'Siddharth Mehta',
    authorRole: 'Markets & Macroeconomics',
    bureau: 'Frankfurt Bureau',
    publishedAt: '2026-11-12T15:20:00Z',
    displayDate: 'Nov 12, 2026 · 15:20 UTC',
    readTime: '4 min read',
    paragraphs: [
      'FRANKFURT — Senior monetary officials across G10 reserve banks announced harmonized standing repurchase terms on Thursday to smooth overnight money-market liquidity ahead of an unusually concentrated first-quarter sovereign bond calendar.',
      'Primary dealers welcomed the standardized collateral haircuts, noting that quarterly balance-sheet reporting windows had previously triggered abrupt spikes in overnight repo rates.',
      'Analysts emphasized the move is operational rather than a shift in benchmark policy rates, preserving strict inflation targets while keeping plumbing resilient.'
    ]
  },
  {
    id: 'nh24-007',
    slug: 'open-standards-newsroom-verification-protocol',
    category: 'Technology',
    tier: 'wire',
    views: 1610,
    kicker: 'Media Standards',
    title: 'Open-Standards Cryptographic Content Provenance Adopted by 140 Public Broadcasters',
    deck: 'News agencies embed tamper-evident capture signatures directly into photojournalism and broadcast field feeds.',
    author: 'Nadia Kowalski',
    authorRole: 'Media & Digital Infrastructure',
    bureau: 'Warsaw Desk',
    publishedAt: '2026-11-12T11:45:00Z',
    displayDate: 'Nov 12, 2026 · 11:45 UTC',
    readTime: '4 min read',
    paragraphs: [
      'WARSAW — A coalition of one hundred forty regional broadcasters and wire agencies, including News Hub 24+, rolled out unified cryptographic provenance headers for field photography and live video dispatches.',
      'When field photojournalists file images from verified camera bodies, hardware-signed timestamps and location hashes travel alongside standard IPTC captions without exposing confidential source metadata.',
      'Readers and partner syndication desks can inspect verification chains directly in browser readers and mobile news apps.'
    ]
  },
  {
    id: 'nh24-008',
    slug: 'nordic-maritime-corridor-autonomous-freight',
    category: 'World',
    tier: 'wire',
    views: 1185,
    kicker: 'Northern Europe',
    title: 'Nordic Maritime Corridor Certifies Winter Navigation Rules for Coastal Hybrid Vessels',
    deck: 'Updated ice-class charting standards clear zero-emission coastal ferries for year-round fjord logistics.',
    author: 'Soren Lindholm',
    authorRole: 'Nordic Correspondent',
    bureau: 'Oslo Bureau',
    publishedAt: '2026-11-12T08:10:00Z',
    displayDate: 'Nov 12, 2026 · 08:10 UTC',
    readTime: '3 min read',
    paragraphs: [
      'OSLO — Maritime safety authorities published updated winter certification guidelines Friday covering battery-hybrid coastal cargo ferries operating between Bergen, Tromso, and coastal aquaculture hubs.',
      'Shore-side megawatt charging arms heated against sub-zero spray passed ninety-day endurance trials without manual crew intervention.',
      'Regional municipalities estimate the corridor will displace more than forty thousand heavy diesel truck crossings annually.'
    ]
  },
  {
    id: 'nh24-009',
    slug: 'bipartisan-civic-transit-charter-passes-committee',
    category: 'Politics',
    tier: 'wire',
    views: 2740,
    kicker: 'Legislative Watch',
    title: 'Cross-Party Municipal Infrastructure Bill Clears Parliamentary Budget Committee',
    deck: 'Lawmakers lock in ten-year dedicated capital grants for regional commuter rail and transparent municipal procurement ledgers.',
    author: 'Maya Lin-Kerrigan',
    authorRole: 'Senior Political Correspondent',
    bureau: 'Washington & Ottawa Desk',
    publishedAt: '2026-11-13T03:25:00Z',
    displayDate: 'Nov 13, 2026 · 03:25 UTC',
    readTime: '5 min read',
    pullQuote: 'Predictable multi-year municipal funding ends the annual stop-start cycle that inflates public transit costs.',
    paragraphs: [
      'CAPITOL HILL — A cross-party legislative coalition advanced the Municipal Transit & Open Ledger Act out of committee late Thursday, securing broad support for multi-year rail electrification grants.',
      'Under the bill’s oversight provisions, every municipal contractor receiving federal matching capital must publish itemized milestone schedules in an open public procurement index.',
      'Floor debate begins Monday morning, with mayors from twenty-four metropolitan transit authorities urging swift passage before winter recess.'
    ]
  },
  {
    id: 'nh24-010',
    slug: 'continental-track-athletics-finals-record-splits',
    category: 'Sports',
    tier: 'wire',
    views: 3480,
    kicker: 'Track & Field',
    title: 'Continental Athletics Invitational Sees Three Championship Marks Fall Under Floodlights',
    deck: 'Sprinters and distance tactical pacers deliver blistering late-season splits as national federations test new lane telemetry.',
    author: 'Devon Mercer',
    authorRole: 'Chief Sports Desk',
    bureau: 'Kingston & London Sports Unit',
    publishedAt: '2026-11-13T01:40:00Z',
    displayDate: 'Nov 13, 2026 · 01:40 UTC',
    readTime: '4 min read',
    pullQuote: 'Tactical pacing in the middle 800 meters turned a cautious final into an unforgettable sprint for the tape.',
    paragraphs: [
      'KINGSTON — High-tempo relay exchanges and an aggressive opening lap in the women’s 1,500 meters produced three championship records Thursday night at the Continental Athletics Invitational.',
      'Race officials debuted real-time optical stride-frequency telemetry along the home straight, giving broadcasters and stadium spectators split-second cadence metrics without intrusive wearable sensors.',
      'Attention now turns to next month’s indoor qualifying circuit, where several medalists confirmed they will step up in distance.'
    ]
  },
  {
    id: 'nh24-011',
    slug: 'independent-soundstages-expand-global-slate',
    category: 'Entertainment',
    tier: 'wire',
    views: 2390,
    kicker: 'Arts & Stage',
    title: 'Independent Music & Live Soundstage Alliance Expands 2027 International Touring Circuit',
    deck: 'Forty-eight mid-sized concert halls launch a shared ticketing standard eliminating hidden secondary-market markups.',
    author: 'Zuri Adeyemi',
    authorRole: 'Culture & Entertainment Editor',
    bureau: 'Lagos & London Culture Desk',
    publishedAt: '2026-11-12T20:15:00Z',
    displayDate: 'Nov 12, 2026 · 20:15 UTC',
    readTime: '4 min read',
    paragraphs: [
      'LONDON — A coalition of forty-eight independent live music venues across Europe, West Africa, and North America unveiled a unified face-value fan exchange network for the 2027 touring season.',
      'Artists booking the circuit gain coordinated freight routing for stage acoustics and transparent box-office settlements settled within forty-eight hours of curtain.',
      'Promoters say capped resale transfers have already restored student and neighborhood attendance across early autumn test dates.'
    ]
  },
  {
    id: 'nh24-012',
    slug: 'harlem-renaissance-archival-radio-reels-restored',
    category: 'Black History',
    tier: 'wire',
    views: 2910,
    kicker: 'Heritage & Archives',
    title: 'Newly Restored 1930s Harlem & Pan-African Broadcast Reels Enter Public Digital Archive',
    deck: 'Sound preservationists digitize 180 hours of rare civic speeches, jazz ensembles, and community journalism recordings.',
    author: 'Dr. Julian Brooks',
    authorRole: 'History & Cultural Preservation',
    bureau: 'New York Archive Desk',
    publishedAt: '2026-11-12T17:05:00Z',
    displayDate: 'Nov 12, 2026 · 17:05 UTC',
    readTime: '6 min read',
    pullQuote: 'Hearing these original neighborhood broadcasts uncut restores the living cadence of Black civic organizing and artistry.',
    paragraphs: [
      'NEW YORK — Audio archivists released more than one hundred eighty hours of newly restored lacquer transcription discs Friday, capturing rare 1930s Harlem town-hall debates, literary readings, and live big-band radio sessions.',
      'Long stored in temperature-controlled vaults, the fragile acetate masters were scanned optically without physical needle contact, recovering spoken-word essays by early Black newspaper columnists and labor organizers.',
      'Educators and public libraries worldwide can stream and cite the annotated transcripts royalty-free beginning this week.'
    ]
  },
  {
    id: 'nh24-013',
    slug: 'autumn-festival-cinema-snippets-70mm-restoration',
    category: 'Movie Snippets',
    tier: 'wire',
    views: 2105,
    kicker: 'Cinema Reel',
    title: 'Movie Snippets: 70mm Archival Teasers & Director Breakdowns From the Autumn Film Showcase',
    deck: 'Quick-cut production notes from five standout premieres, practical miniature lighting setups, and restored repertory prints.',
    author: 'Camille Laurent',
    authorRole: 'Film & Cinema Critic',
    bureau: 'Paris Cinema Desk',
    publishedAt: '2026-11-12T14:50:00Z',
    displayDate: 'Nov 12, 2026 · 14:50 UTC',
    readTime: '3 min read',
    paragraphs: [
      'PARIS — Cinematographers at this week’s Autumn Film Showcase spotlighted practical in-camera lighting rigs, releasing three-minute behind-the-lens snippets from five upcoming theatrical features.',
      'Standout previews included a tactile 70mm maritime thriller shot largely on gimbaled harbor barges and an intimate two-character drama lit exclusively by tungsten streetlamps.',
      'Festival programmers confirmed all five preview reels will travel to repertory theaters alongside newly struck photochemical prints.'
    ]
  },
  {
    id: 'nh24-014',
    slug: 'serialized-sci-fi-noir-comic-issue-14-preview',
    category: 'Comic Series',
    tier: 'wire',
    views: 1875,
    kicker: 'Sequential Art',
    title: 'Comic Series Dispatch: “Orbital Meridian #14” Merges Ink-Wash Noir With Print Serialization',
    deck: 'Independent creators revive weekly newspaper-style adventure strips alongside collectible print issues and creator-owned rights.',
    author: 'Kenji Takahashi',
    authorRole: 'Comics & Graphic Literature',
    bureau: 'Tokyo & Portland Desk',
    publishedAt: '2026-11-12T12:10:00Z',
    displayDate: 'Nov 12, 2026 · 12:10 UTC',
    readTime: '4 min read',
    paragraphs: [
      'TOKYO — Creator-owned sequential art collective Meridian Press unveiled Issue #14 of its flagship sci-fi noir comic series, pairing hand-inked brush panels with weekly digital broadsheet installments.',
      'Readers follow investigative courier Hana Sato across orbital relay stations, with each episode structured around classic four-tier Sunday broadsheet pacing.',
      'Comic shop pre-orders rose forty percent this quarter as serialized print-first anthologies regain momentum among younger graphic novel readers.'
    ]
  },
  {
    id: 'nh24-015',
    slug: 'transparent-sponsorship-standards-commercials-ads',
    category: 'Commercials & Ads',
    tier: 'wire',
    views: 1560,
    kicker: 'Brand & Media Markets',
    title: 'Global Broadcasters Adopt Clean Frame-Label Standards for Commercials & Branded Ads',
    deck: 'New creative guidelines boost viewer recall by pairing concise 15-second storytelling spots with clear sponsorship separation.',
    author: 'Rachel Sterling',
    authorRole: 'Advertising & Media Economics',
    bureau: 'Chicago & London Desk',
    publishedAt: '2026-11-12T09:30:00Z',
    displayDate: 'Nov 12, 2026 · 09:30 UTC',
    readTime: '4 min read',
    paragraphs: [
      'CHICAGO — Major broadcast networks and independent digital publishers ratified updated creative benchmarks for commercials and native ad placements, emphasizing crisp fifteen-second narrative spots and unmistakable editorial labeling.',
      'Brand-lift studies presented at the Autumn Media Forum showed viewers trusted sponsor messages significantly more when commercial blocks were visually separated from news reporting without intrusive pop-up overlays.',
      'Agencies participating in the News Hub 24+.com commercial syndication exchange can now submit verified ad creatives directly alongside regional campaign schedules.'
    ]
  }
];

export interface AgencyCapability {
  index: string;
  title: string;
  description: string;
  deliverable: string;
}

export const AGENCY_CAPABILITIES: AgencyCapability[] = [
  {
    index: '01.',
    title: 'Global Wire & Real-Time Dispatch',
    description:
      'Continuous 24-hour reporting across 42 international bureaus delivering verified breaking coverage in text, high-resolution photojournalism, and broadcast audio.',
    deliverable: 'RSS 2.0, NewsML-G2 & Live Wire Feeds'
  },
  {
    index: '02.',
    title: 'Investigative Desk & Verification',
    description:
      'Dedicated data journalists, maritime analysts, and multi-lingual fact-checkers auditing primary documents before publication.',
    deliverable: 'Signed Provenance & Public Document Dossiers'
  },
  {
    index: '03.',
    title: 'Search-Engine Indexed Syndication',
    description:
      'Built from the ground up with Google News XML sitemaps, Schema.org NewsMediaOrganization structured data, and open crawler directives.',
    deliverable: 'Google, Bing, DuckDuckGo & Yahoo Discovery'
  },
  {
    index: '04.',
    title: 'Direct Mobile Distribution (APK)',
    description:
      'Zero-gatekeeping distribution via our signed Android package (NewsHub24Plus-v2.4.0.apk) with offline edition caching and breaking dispatch alerts.',
    deliverable: 'Verified SHA-256 Android Package Download'
  }
];

export const AGENCY_METRICS = [
  { value: '42', label: 'Global Field Bureaus' },
  { value: '184', label: 'Syndication Partner Outlets' },
  { value: '24/7', label: 'Continuous Editorial Desk' },
  { value: '< 90s', label: 'Breaking Wire Turnaround' }
];

export interface ApkReleaseEntry {
  version: string;
  versionCode: number;
  releaseDate: string;
  channel: 'Current Stable' | 'Previous Release' | 'Archive';
  summary: string;
  notes: string[];
}

export const APK_RELEASE_HISTORY: ApkReleaseEntry[] = [
  {
    version: '2.4.0',
    versionCode: 240,
    releaseDate: 'November 13, 2026',
    channel: 'Current Stable',
    summary:
      'Introduces real-time Breaking News wire alerts, Base44 portal synchronization, and cryptographic provenance badge verification.',
    notes: [
      'Added Breaking News live wire priority banner synced with Geneva, London, and Rotterdam desks.',
      'Integrated direct News Hub 24+.com REST and RSS 2.0 wire feed endpoints for zero-latency updates.',
      'Upgraded offline morning edition cache to store full long-form investigative dossiers and figure captions.',
      'Target SDK updated to Android 15 (API 35) with SHA-256 package entry manifest verification.'
    ]
  },
  {
    version: '2.3.1',
    versionCode: 231,
    releaseDate: 'October 28, 2026',
    channel: 'Previous Release',
    summary:
      'Performance refinement for low-bandwidth field correspondents and improved search filtering across bureau archives.',
    notes: [
      'Reduced background RSS polling payload size by 38% over metered cellular connections.',
      'Added full-text search across article titles, decks, bureau tags, and correspondent names.',
      'Fixed screen reader focus restoration when closing full-screen dispatch views.'
    ]
  },
  {
    version: '2.2.0',
    versionCode: 220,
    releaseDate: 'September 14, 2026',
    channel: 'Archive',
    summary:
      'Introduced broadsheet typography engine, multi-bureau wire categorization, and standalone APK distribution.',
    notes: [
      'Launched editorial broadsheet reader layout with drop caps and pull-quote formatting.',
      'Added category tabs for World, Economy, Climate, Technology, and Investigations.',
      'Enabled direct standalone APK packaging without third-party store telemetry.'
    ]
  }
];

export function formatFileSizeUnlimited(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return idx <= 1 ? `${Math.round(value)} ${units[idx]}` : `${value.toFixed(2)} ${units[idx]}`;
}

export interface VideoReelItem {
  id: string;
  title: string;
  category: Exclude<NewsCategory, 'All'>;
  creator: string;
  bureau: string;
  durationSec: number;
  imageKey: ImageKey;
  caption: string;
  sponsorCtaLabel: string;
  sponsorUrlLabel: string;
  linkedArticleId: string;
  initialViews: number;
  initialWatchSeconds: number;
  initialClicks: number;
  initialEarnedUsd: number;
  videoUrl?: string;
  fileName?: string;
  fileSizeBytes?: number;
  fileSizeFormatted?: string;
  isUserUploaded?: boolean;
}

export const VIDEO_REELS: VideoReelItem[] = [
  {
    id: 'reel-001',
    title: 'Geneva Summit Broadcast: Inside the 38-Nation Digital Trade Vote',
    category: 'World',
    creator: 'Elena Rostova · Video Desk',
    bureau: 'Geneva Bureau',
    durationSec: 24,
    imageKey: 'hero_lead_summit',
    caption: 'Live plenary floor highlights and tariff-free news wire ratification.',
    sponsorCtaLabel: 'Sponsor: Open Wire Cloud Infrastructure',
    sponsorUrlLabel: 'openwire.newshub24plus.com',
    linkedArticleId: 'nh24-001',
    initialViews: 4280,
    initialWatchSeconds: 74900,
    initialClicks: 615,
    initialEarnedUsd: 164.45
  },
  {
    id: 'reel-002',
    title: 'Movie Snippets Reel: 70mm Harbor Lighting & Autumn Premiere Cuts',
    category: 'Movie Snippets',
    creator: 'Camille Laurent · Cinema Unit',
    bureau: 'Paris Cinema Desk',
    durationSec: 22,
    imageKey: 'apk_mobile_showcase',
    caption: 'Practical miniature rigging and tungsten streetlamp cinematography breakdowns.',
    sponsorCtaLabel: 'Sponsor: Meridian 70mm Repertory Pass',
    sponsorUrlLabel: 'cinema.newshub24plus.com',
    linkedArticleId: 'nh24-013',
    initialViews: 3890,
    initialWatchSeconds: 61420,
    initialClicks: 540,
    initialEarnedUsd: 142.8
  },
  {
    id: 'reel-003',
    title: 'Sports Highlight: Continental Invitational Sprint Cadence Telemetry',
    category: 'Sports',
    creator: 'Devon Mercer · Track & Field',
    bureau: 'Kingston & London',
    durationSec: 20,
    imageKey: 'feature_global_trade',
    caption: 'Floodlit home-straight finish and real-time stride-frequency overlays.',
    sponsorCtaLabel: 'Sponsor: Velocity Track Timing Systems',
    sponsorUrlLabel: 'sports.newshub24plus.com',
    linkedArticleId: 'nh24-010',
    initialViews: 5120,
    initialWatchSeconds: 86100,
    initialClicks: 790,
    initialEarnedUsd: 198.2
  },
  {
    id: 'reel-004',
    title: 'Black History Special: Restoring 1930s Harlem Broadcast Lacquer Discs',
    category: 'Black History',
    creator: 'Dr. Julian Brooks · Archives',
    bureau: 'New York Archive Desk',
    durationSec: 28,
    imageKey: 'feature_quantum_lab',
    caption: 'Optical non-contact audio recovery of civic town halls and big-band sessions.',
    sponsorCtaLabel: 'Sponsor: Public Heritage Audio Grant',
    sponsorUrlLabel: 'archives.newshub24plus.com',
    linkedArticleId: 'nh24-012',
    initialViews: 3640,
    initialWatchSeconds: 71200,
    initialClicks: 492,
    initialEarnedUsd: 138.6
  },
  {
    id: 'reel-005',
    title: 'Commercials & Ads Showcase: Clean-Frame 15s Brand Storytelling Spot',
    category: 'Commercials & Ads',
    creator: 'Rachel Sterling · Brand Studio',
    bureau: 'Chicago & London',
    durationSec: 18,
    imageKey: 'feature_energy_grid',
    caption: 'Transparent sponsored segment demonstrating zero-pop-up broadcast recall.',
    sponsorCtaLabel: 'Book Sponsored Commercial Spot ($0.45/Click)',
    sponsorUrlLabel: 'ads.newshub24plus.com',
    linkedArticleId: 'nh24-015',
    initialViews: 2950,
    initialWatchSeconds: 44250,
    initialClicks: 840,
    initialEarnedUsd: 215.9
  },
  {
    id: 'reel-006',
    title: 'Entertainment & Soundstage Tour: Independent Venues 2027 Slate',
    category: 'Entertainment',
    creator: 'Zuri Adeyemi · Culture Desk',
    bureau: 'Lagos & London',
    durationSec: 25,
    imageKey: 'hero_lead_summit',
    caption: 'Forty-eight live halls launch capped face-value fan ticketing worldwide.',
    sponsorCtaLabel: 'Sponsor: Fair-Value Stage Pass',
    sponsorUrlLabel: 'stage.newshub24plus.com',
    linkedArticleId: 'nh24-011',
    initialViews: 3180,
    initialWatchSeconds: 51900,
    initialClicks: 465,
    initialEarnedUsd: 129.35
  }
];

export interface AuthorProfile {
  name: string;
  role: string;
  bureau: string;
  yearsReporting: number;
  languages: string;
  credentials: string;
  bio: string;
  expertise: string[];
  contactEmail: string;
}

export const AUTHOR_PROFILES: Record<string, AuthorProfile> = {
  'Elena Rostova': {
    name: 'Elena Rostova',
    role: 'Chief Diplomatic Correspondent',
    bureau: 'Geneva Bureau',
    yearsReporting: 14,
    languages: 'English · French · Russian',
    credentials: 'Geneva Palais Accredited · Cross-Border Digital Trade Fellow',
    bio: 'Elena Rostova directs News Hub 24+ multilateral reporting from Geneva, covering digital customs treaties, WTO dispute panels, and international press-freedom protections across Europe and Asia-Pacific.',
    expertise: [
      'Multilateral Trade Treaties',
      'Cross-Border Data Governance',
      'Press Freedom & Wire Law',
      'Sovereign Diplomacy'
    ],
    contactEmail: 'newshub24plus@gmail.com'
  },
  'Marcus Vance': {
    name: 'Marcus Vance',
    role: 'Senior Maritime & Trade Editor',
    bureau: 'Rotterdam Desk',
    yearsReporting: 11,
    languages: 'English · Dutch · German',
    credentials: 'European Port Logistics Reporter · Maritime Telemetry Analyst',
    bio: 'Based at Rotterdam Europort, Marcus Vance tracks container terminal automation, intermodal freight rail corridors, and maritime decarbonization compacts across North Sea and East Asian shipping lanes.',
    expertise: [
      'Deep-Water Port Automation',
      'Global Supply Chain Telemetry',
      'Maritime Freight Economics',
      'Dockworker Labor Compacts'
    ],
    contactEmail: 'newshub24plus@gmail.com'
  },
  'Henrik Lindqvist': {
    name: 'Henrik Lindqvist',
    role: 'Energy & Climate Correspondent',
    bureau: 'Aberdeen Field Unit',
    yearsReporting: 9,
    languages: 'English · Swedish · Norwegian',
    credentials: 'HVDC Subsea Infrastructure Specialist · North Sea Field Press',
    bio: 'Henrik Lindqvist reports from offshore wind platforms, coastal converter stations, and industrial battery parks across Scotland and Scandinavia, translating complex grid engineering into clear public accountability.',
    expertise: [
      'Subsea HVDC Interconnectors',
      'Offshore Wind & Solar Hybrids',
      'Grid Balancing & Storage',
      'Industrial Decarbonization'
    ],
    contactEmail: 'newshub24plus@gmail.com'
  },
  'Dr. Amara Okafor': {
    name: 'Dr. Amara Okafor',
    role: 'Science & Technology Editor',
    bureau: 'Zurich Science Desk',
    yearsReporting: 10,
    languages: 'English · Igbo · German',
    credentials: 'PhD Applied Photonics · Semiconductor Metrology Editor',
    bio: 'Dr. Amara Okafor leads deep technical coverage on quantum timing chips, silicon photonics, and resilient telecommunications synchronization across Zurich, Dresden, and West African research hubs.',
    expertise: [
      'Quantum Metrology & Timing',
      'Silicon Photonics Foundries',
      'Telecom Resilience',
      'Peer-Reviewed R&D Auditing'
    ],
    contactEmail: 'newshub24plus@gmail.com'
  },
  'Claire Beaumont & Tariq Al-Mansoor': {
    name: 'Claire Beaumont & Tariq Al-Mansoor',
    role: 'Investigative Desk',
    bureau: 'London & Marseille',
    yearsReporting: 13,
    languages: 'English · French · Arabic',
    credentials: 'Subsea Cable & Maritime AIS Forensics Unit',
    bio: 'Claire Beaumont and Tariq Al-Mansoor co-lead News Hub 24+ cross-border infrastructure investigations, combining maritime transponder logs, hydrographic filings, and public procurement registries.',
    expertise: [
      'Subsea Fiber Security',
      'Maritime AIS Log Forensics',
      'Financial Clearing Infrastructure',
      'Public Document Audits'
    ],
    contactEmail: 'newshub24plus@gmail.com'
  },
  'Siddharth Mehta': {
    name: 'Siddharth Mehta',
    role: 'Markets & Macroeconomics',
    bureau: 'Frankfurt Bureau',
    yearsReporting: 12,
    languages: 'English · Hindi · German',
    credentials: 'G10 Central Bank & Sovereign Debt Correspondent',
    bio: 'Siddharth Mehta covers European Central Bank operations, money-market repo plumbing, and sovereign treasury auctions from Frankfurt, with a focus on systemic liquidity stability.',
    expertise: [
      'Central Bank Liquidity Facilities',
      'Sovereign Treasury Issuance',
      'Overnight Repo Markets',
      'Inflation & Monetary Policy'
    ],
    contactEmail: 'newshub24plus@gmail.com'
  },
  'Nadia Kowalski': {
    name: 'Nadia Kowalski',
    role: 'Media & Digital Infrastructure',
    bureau: 'Warsaw Desk',
    yearsReporting: 8,
    languages: 'English · Polish · Ukrainian',
    credentials: 'C2PA Content Provenance & Broadcast Verification Lead',
    bio: 'Nadia Kowalski tracks open-standards cryptographic verification for photojournalism and broadcast video feeds, working with newsrooms across Central Europe to safeguard source privacy.',
    expertise: [
      'Cryptographic Media Provenance',
      'Broadcast Standards & IPTC',
      'Field Verification Systems',
      'Public Broadcaster Syndication'
    ],
    contactEmail: 'newshub24plus@gmail.com'
  },
  'Soren Lindholm': {
    name: 'Soren Lindholm',
    role: 'Nordic Correspondent',
    bureau: 'Oslo Bureau',
    yearsReporting: 9,
    languages: 'English · Norwegian · Danish',
    credentials: 'Arctic & Coastal Electrification Reporter',
    bio: 'Soren Lindholm covers coastal battery-hybrid shipping, Arctic navigation standards, and municipal clean-freight logistics from Oslo and Bergen.',
    expertise: [
      'Zero-Emission Maritime Corridors',
      'Ice-Class Charting Standards',
      'Megawatt Shore Charging',
      'Nordic Municipal Policy'
    ],
    contactEmail: 'newshub24plus@gmail.com'
  },
  'Maya Lin-Kerrigan': {
    name: 'Maya Lin-Kerrigan',
    role: 'Senior Political Correspondent',
    bureau: 'Washington & Ottawa Desk',
    yearsReporting: 11,
    languages: 'English · Mandarin · French',
    credentials: 'Parliamentary & Municipal Infrastructure Desk Lead',
    bio: 'Maya Lin-Kerrigan reports on cross-party legislative budgets, federal-municipal transit compacts, and open public procurement ledgers across North America.',
    expertise: [
      'Legislative Budget Oversight',
      'Public Transit Capital Grants',
      'Open Procurement Ledgers',
      'Municipal Governance'
    ],
    contactEmail: 'newshub24plus@gmail.com'
  },
  'Devon Mercer': {
    name: 'Devon Mercer',
    role: 'Chief Sports Desk',
    bureau: 'Kingston & London Sports Unit',
    yearsReporting: 10,
    languages: 'English',
    credentials: 'World Athletics Accredited · Optical Performance Telemetry Editor',
    bio: 'Devon Mercer directs international track, field, and federation coverage for News Hub 24+, examining how real-time optical stride telemetry is reshaping coaching and broadcast analysis.',
    expertise: [
      'International Track & Field',
      'Sprint Biomechanics & Cadence',
      'Broadcast Sports Telemetry',
      'Federation Qualifying Circuits'
    ],
    contactEmail: 'newshub24plus@gmail.com'
  },
  'Zuri Adeyemi': {
    name: 'Zuri Adeyemi',
    role: 'Culture & Entertainment Editor',
    bureau: 'Lagos & London Culture Desk',
    yearsReporting: 9,
    languages: 'English · Yoruba',
    credentials: 'Live Soundstage & Independent Touring Economics Critic',
    bio: 'Zuri Adeyemi covers global live music ecosystems, fair-value ticketing reform, and touring logistics linking West African, European, and North American independent venues.',
    expertise: [
      'Independent Music Circuits',
      'Fair-Value Ticketing Reform',
      'West African & UK Soundstages',
      'Creator Revenue Economics'
    ],
    contactEmail: 'newshub24plus@gmail.com'
  },
  'Dr. Julian Brooks': {
    name: 'Dr. Julian Brooks',
    role: 'History & Cultural Preservation',
    bureau: 'New York Archive Desk',
    yearsReporting: 15,
    languages: 'English · Spanish',
    credentials: 'PhD Archival History · Optical Audio Preservation Advisor',
    bio: 'Dr. Julian Brooks leads the Black History & Heritage desk, partnering with sound preservationists and community libraries to restore and contextualize 20th-century Pan-African and Harlem broadcasts.',
    expertise: [
      'Black History & Civic Archives',
      'Harlem Renaissance Radio History',
      'Optical Audio Restoration',
      'Public Cultural Preservation'
    ],
    contactEmail: 'newshub24plus@gmail.com'
  },
  'Camille Laurent': {
    name: 'Camille Laurent',
    role: 'Film & Cinema Critic',
    bureau: 'Paris Cinema Desk',
    yearsReporting: 10,
    languages: 'English · French · Italian',
    credentials: 'FIPRESCI Member · 70mm Photochemical Preservation Critic',
    bio: 'Camille Laurent curates News Hub 24+ Movie Snippets and festival dispatches from Paris and Cannes, focusing on practical in-camera cinematography and repertory film restoration.',
    expertise: [
      '70mm Cinematography & Lighting',
      'International Film Festivals',
      'Repertory Film Restoration',
      'Director Production Breakdowns'
    ],
    contactEmail: 'newshub24plus@gmail.com'
  },
  'Kenji Takahashi': {
    name: 'Kenji Takahashi',
    role: 'Comics & Graphic Literature',
    bureau: 'Tokyo & Portland Desk',
    yearsReporting: 8,
    languages: 'English · Japanese',
    credentials: 'Sequential Art Critic · Creator-Owned Serialization Editor',
    bio: 'Kenji Takahashi covers serialized graphic fiction, independent comic syndication, and creator-owned broadsheet publishing across Tokyo and the Pacific Northwest.',
    expertise: [
      'Serialized Comic Strips',
      'Creator-Owned Publishing',
      'Ink-Wash & Noir Illustration',
      'Print-First Graphic Anthologies'
    ],
    contactEmail: 'newshub24plus@gmail.com'
  },
  'Rachel Sterling': {
    name: 'Rachel Sterling',
    role: 'Advertising & Media Economics',
    bureau: 'Chicago & London Desk',
    yearsReporting: 11,
    languages: 'English',
    credentials: 'IAB Transparency Fellow · Brand Sponsorship Standards Analyst',
    bio: 'Rachel Sterling analyzes transparent commercial storytelling, clean-frame ad labeling, and sustainable reader-plus-sponsor revenue models for independent digital publishers.',
    expertise: [
      'Commercials & Branded Spots',
      'Clean-Frame Sponsorship Standards',
      'Publisher RPM & CPC Economics',
      'Audience Trust Metrics'
    ],
    contactEmail: 'newshub24plus@gmail.com'
  }
};

export function resolveAuthorProfile(
  authorName: string,
  fallbackRole?: string,
  fallbackBureau?: string,
  allArticles: NewsArticle[] = []
): AuthorProfile {
  const cleanName = authorName.trim();
  const known = AUTHOR_PROFILES[cleanName];
  if (known) return known;

  const authored = allArticles.filter(
    (a) => a.author.trim().toLowerCase() === cleanName.toLowerCase()
  );
  const categories = Array.from(new Set(authored.map((a) => a.category)));
  const primaryBureau = fallbackBureau || authored[0]?.bureau || 'News Hub 24+ Contributor Network';
  const primaryRole = fallbackRole || authored[0]?.authorRole || 'Contributing Journalist';

  return {
    name: cleanName,
    role: primaryRole,
    bureau: primaryBureau,
    yearsReporting: 3,
    languages: 'English',
    credentials: `Verified News Hub 24+ Contributor · ${primaryBureau}`,
    bio: `${cleanName} contributes verified dispatches and reader-edition stories to News Hub 24+ (${primaryBureau}), covering ${categories.length > 0 ? categories.join(', ') : 'global news and culture'}.`,
    expertise:
      categories.length > 0
        ? [...categories, 'Reader Edition Reporting']
        : ['Global Wire Reporting', 'Community Journalism'],
    contactEmail: 'newshub24plus@gmail.com'
  };
}


