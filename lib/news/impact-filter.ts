type HeadlineBase = {
  title: string;
  source: string;
  publishedAt?: string;
  url?: string;
};

type ImpactRule = {
  id: string;
  /** Korte tag voor UI (Nederlands) */
  labelNl: string;
  /** Punten als minstens één pattern matcht (één keer per regel) */
  weight: number;
  patterns: RegExp[];
};

/**
 * Regels gericht op gebeurtenissen die historisch sterke correlatie tonen met
 * risk-on/risk-off en cryptovolatiliteit. Alleen headlines die hier minstens
 * op dreigen te voldoen komen in de UI / LLM-context.
 */
const IMPACT_RULES: ImpactRule[] = [
  {
    id: 'macro',
    labelNl: 'Macro / rente',
    weight: 4,
    patterns: [
      /\bfederal reserve\b|\bfomc\b|\bjerome powell\b|\binterest rates?\b|\brate (?:cut|cuts|hike|hikes|decision)\b|\bpowell says\b/i,
      /\binflation\b|\bcpi\b|\bpce\b|\bconsumer price\b|\bproducer price\b|\bppi\b/i,
      /\bjobs? report\b|\bnon-?farm\b|\bnfp\b|\bunemployment\b/i,
      /\btreasury yields?\b|\bbond yields?\b|\byield curve\b|\bdxy\b|\bdollar index\b/i,
      /\bquantitative (?:easing|tightening)\b|\bqe\b|\bqt\b|\bstimulus\b/i,
      /\b(?:ecb|european central bank|bank of england|bank of japan)\b.*\b(?:rate|policy)\b/i,
      /\brecession\b|\bstagflation\b|\bgdp\b.*\b(contraction|shrunk|growth)\b/i,
    ],
  },
  {
    id: 'regulation',
    labelNl: 'Regelgeving',
    weight: 4,
    patterns: [
      /\bsec\b.*\b(?:approv|den|lawsuit|charg|settl|etf|crypto|bitcoin)\b/i,
      /\b(?:spot )?bitcoin etf\b|\b(?:spot )?ethereum etf\b|\betf approval\b/i,
      /\bcftc\b|\bregulat(?:or|ion|ory)\b.*\bcrypto\b|\bcrypto.*\b(?:ban|legal|bill|law)\b/i,
      /\bexecutive order\b.*\bcrypto\b|\bmica\b|\bstablecoin (?:bill|act|regulation)\b/i,
      /\bsanctions?\b.*\b(?:crypto|bitcoin|wallet)\b|\bcrypto (?:sanction|exchange) ban\b/i,
    ],
  },
  {
    id: 'geopolitics',
    labelNl: 'Geopolitiek',
    weight: 4,
    patterns: [
      /\bwar\b|\binvasion\b|\bmissile\b|\bair strike\b|\bmilitary conflict\b|\bnato\b/i,
      /\burgent ceasefire\b|\bpeace (?:talks|plan)\b|\b(?:russia|ukraine|gaza|israel|iran|taiwan|china)\b.*\b(?:conflict|tension|attack)\b/i,
      /\bsanctions?\b.*\b(?:russia|iran|china|opcw)\b|\bembargo\b.*\b(?:oil|energy)\b/i,
    ],
  },
  {
    id: 'banking',
    labelNl: 'Banken / krediet',
    weight: 4,
    patterns: [
      /\bbank (?:failure|run|collapse|rescue|bailout)\b|\bcredit (?:crunch|event)\b/i,
      /\bliquidity crisis\b|\bcontagion\b.*\b(?:bank|finance)\b/i,
    ],
  },
  {
    id: 'crypto_stress',
    labelNl: 'Crypto-marktstress',
    weight: 4,
    patterns: [
      /\bhack\b|\bexploit\b|\b(?:exchange|bridge) (?:hack|breach)\b|\bmillion.*(?:stolen|lost)\b.*\bcrypto\b/i,
      /\bbankruptcy\b.*\b(?:crypto|exchange|ftx)\b|\b(?:ftx|binance|coinbase)\b.*\b(?:bankrupt|charges|settlement)\b/i,
      /\bde-?peg\b|\bstablecoin (?:crisis|depeg)\b|\busdc\b.*\bdepeg\b|\btether\b.*\b(?:probe|sec|reserve)\b/i,
      /\bmass liquidation\b|\bliquidation cascade\b|\bcrypto lender\b.*\b(?:halt|default)\b/i,
    ],
  },
  {
    id: 'energy',
    labelNl: 'Energie / grondstoffen',
    weight: 3,
    patterns: [
      /\bopec\b|\boil (?:surge|plunge|prices? spike)\b|\b(?:brent|wti)\b.*\b(?:record|rally|crash)\b/i,
      /\bstrategic petroleum\b|\benergy shock\b|\bgas prices?\b.*\b(?:spike|surge)\b/i,
    ],
  },
  {
    id: 'trade',
    labelNl: 'Handel / tarieven',
    weight: 3,
    patterns: [
      /\btariff\b|\btariffs\b|\btrade war\b|\bus-china trade\b|\bimport duties\b/i,
      /\btrump\b.*\b(?:tariff|trade|sanction)\b/i,
    ],
  },
  {
    id: 'adoption_policy',
    labelNl: 'Adoptie / beleid',
    weight: 3,
    patterns: [
      /\blegal tender\b.*\bbitcoin\b|\bbitcoin (?:as|legal tender)\b|\bnational (?:bitcoin|crypto) (?:reserve|treasury)\b/i,
      /\b(?:country|nation|government)\b.*\b(?:adopts?|bans?) (?:bitcoin|crypto)\b/i,
    ],
  },
  {
    id: 'protocol',
    labelNl: 'Protocol / netwerk',
    weight: 3,
    patterns: [
      /\bbitcoin halving\b|\beth(?:ereum)? (?:merge|upgrade|hard fork)\b|\bethereum (?:pos|upgrade)\b/i,
      /\bmajor (?:outage|outages)\b.*\b(?:ethereum|solana|blockchain)\b/i,
    ],
  },
];

/** Labels / opinie zonder duidelijke nieuwe marktfactor — extra streng filteren */
const LOW_SIGNAL_PATTERNS: RegExp[] = [
  /\b(?:celebrity|influencer|podcaster)\b/i,
  /\bprice prediction\b|\bcould reach \$\d/i,
  /\b(?:dogecoin|shiba|meme coin|memecoin)\b(?!.*\b(?:sec|regulation|etf)\b)/i,
  /\bwhat (?:bitcoin|btc) (?:needs|might)\b/i,
];

const MIN_IMPACT_SCORE = 3;

export type ScoredHeadline = HeadlineBase & {
  impactScore: number;
  impactCategories: string[];
};

function matchesAny(patterns: RegExp[], title: string): boolean {
  return patterns.some((p) => p.test(title));
}

function isLowSignal(title: string): boolean {
  return LOW_SIGNAL_PATTERNS.some((p) => p.test(title));
}

export function scoreHeadlineImpact(title: string): {
  score: number;
  categories: string[];
} {
  const t = title.trim();
  if (!t || isLowSignal(t)) return { score: 0, categories: [] };

  let score = 0;
  const categories: string[] = [];

  for (const rule of IMPACT_RULES) {
    if (matchesAny(rule.patterns, t)) {
      score += rule.weight;
      categories.push(rule.labelNl);
    }
  }

  return { score, categories };
}

/**
 * Sorteert op datum (nieuw eerst), filtert op minimale impact-score, dedupeert titels.
 */
export function filterHighImpactHeadlines(
  headlines: HeadlineBase[],
  opts?: { maxItems?: number; minScore?: number },
): ScoredHeadline[] {
  const maxItems = opts?.maxItems ?? 24;
  const minScore = opts?.minScore ?? MIN_IMPACT_SCORE;

  const sorted = [...headlines].sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  const seen = new Set<string>();
  const out: ScoredHeadline[] = [];

  for (const h of sorted) {
    const { score, categories } = scoreHeadlineImpact(h.title);
    if (score < minScore || categories.length === 0) continue;

    const k = h.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 56);
    if (seen.has(k)) continue;
    seen.add(k);

    out.push({
      ...h,
      impactScore: score,
      impactCategories: categories,
    });

    if (out.length >= maxItems) break;
  }

  return out;
}
