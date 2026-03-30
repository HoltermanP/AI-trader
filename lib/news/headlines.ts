import { filterHighImpactHeadlines, type ScoredHeadline } from './impact-filter';
import { translateTitlesToNl } from './translate-headlines';

export type NewsHeadline = {
  title: string;
  source: string;
  publishedAt?: string;
  url?: string;
};

export type { ScoredHeadline };

const FETCH_OPTS: RequestInit = {
  cache: 'no-store',
  headers: {
    'User-Agent':
      'Mozilla/5.0 (compatible; AI-Trader/1.0; +https://example.com) AppleWebKit/537.36 (KHTML, like Gecko)',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
  next: { revalidate: 0 },
};

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').trim();
}

/** Minimale RSS-item extractie (geen externe XML-parser). */
function parseRssItems(xml: string): NewsHeadline[] {
  const items: NewsHeadline[] = [];
  const re = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    let title =
      /<title[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/title>/i.exec(block);
    const rawTitle = title?.[1] ?? title?.[2] ?? '';
    const t = decodeXmlEntities(stripTags(rawTitle)).trim();
    if (!t || t.length < 8) continue;

    let link: string | undefined;
    const linkM = /<link[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/link>/i.exec(block);
    if (linkM) link = decodeXmlEntities(stripTags(linkM[1] ?? linkM[2] ?? '')).trim();
    const guidM = /<guid[^>]*>([\s\S]*?)<\/guid>/i.exec(block);
    if (!link && guidM) link = decodeXmlEntities(stripTags(guidM[1])).trim();

    let pubDate: string | undefined;
    const pubM = /<pubDate>([\s\S]*?)<\/pubDate>/i.exec(block);
    if (pubM) pubDate = stripTags(pubM[1]).trim();

    items.push({
      title: t.slice(0, 280),
      source: 'google-news',
      publishedAt: pubDate,
      url: link,
    });
  }
  return items;
}

const GOOGLE_NEWS_QUERIES = [
  'cryptocurrency+OR+Bitcoin+OR+Ethereum+breaking',
  'Trump+tariff+OR+Trump+stock+market+OR+Trump+crypto',
  'oil+price+OR+OPEC+OR+energy+markets',
  'war+OR+geopolitics+OR+Middle+East+markets',
  'Federal+Reserve+OR+inflation+OR+interest+rates',
];

function googleNewsRssUrl(query: string): string {
  const q = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
}

async function fetchGoogleNewsAll(): Promise<NewsHeadline[]> {
  const out: NewsHeadline[] = [];
  const urls = GOOGLE_NEWS_QUERIES.map(googleNewsRssUrl);

  await Promise.all(
    urls.map(async (url) => {
      try {
        const ctrl = new AbortController();
        const id = setTimeout(() => ctrl.abort(), 10_000);
        const res = await fetch(url, { ...FETCH_OPTS, signal: ctrl.signal });
        clearTimeout(id);
        if (!res.ok) return;
        const xml = await res.text();
        out.push(...parseRssItems(xml));
      } catch {
        /* feed kan tijdelijk falen */
      }
    }),
  );

  return out;
}

type NewsApiArticle = { title?: string; url?: string; publishedAt?: string; source?: { name?: string } };

async function fetchNewsApi(): Promise<NewsHeadline[]> {
  const key = process.env.NEWSAPI_KEY?.trim();
  if (!key) return [];

  const endpoints = [
    `https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=12&apiKey=${encodeURIComponent(key)}`,
    `https://newsapi.org/v2/everything?q=cryptocurrency+OR+Bitcoin+OR+Ethereum&sortBy=publishedAt&language=en&pageSize=15&apiKey=${encodeURIComponent(key)}`,
  ];

  const merged: NewsHeadline[] = [];
  for (const url of endpoints) {
    try {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), 10_000);
      const res = await fetch(url, { ...FETCH_OPTS, signal: ctrl.signal });
      clearTimeout(id);
      if (!res.ok) continue;
      const data = (await res.json()) as { articles?: NewsApiArticle[] };
      const articles = data.articles ?? [];
      for (const a of articles) {
        const title = a.title?.trim();
        if (!title || title.length < 8) continue;
        merged.push({
          title: title.slice(0, 280),
          source: `newsapi:${a.source?.name ?? 'unknown'}`,
          publishedAt: a.publishedAt,
          url: a.url,
        });
      }
    } catch {
      /* optioneel */
    }
  }
  return merged;
}

function normalizeKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 48);
}

export type NewsDigestResult = {
  /** Top 3 impact-headlines, titels in het Nederlands wanneer vertaling lukt. */
  headlines: ScoredHeadline[];
  digestText: string;
  sourcesUsed: string[];
  /** Totaal uniek opgehaald vóór filter (ter info). */
  fetchedBeforeFilter: number;
  /** True als Claude de koppen naar NL heeft gezet. */
  headlinesTranslated: boolean;
};

export async function buildNewsDigest(): Promise<NewsDigestResult> {
  const [google, newsApi] = await Promise.all([fetchGoogleNewsAll(), fetchNewsApi()]);

  const combined = [...newsApi, ...google];
  const seen = new Set<string>();
  const unique: NewsHeadline[] = [];
  for (const h of combined) {
    const k = normalizeKey(h.title);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(h);
  }

  const fetchedBeforeFilter = unique.length;

  const sourcesUsed = ['google-news-rss'];
  if (newsApi.length > 0) sourcesUsed.push('newsapi');

  const lines: string[] = [
    'Top 3 headlines gefilterd op koersimpact (macro/rente, regulering, geopolitiek, banken, cryptostress, energie, tarieven). Koppen in het Nederlands wanneer vertaling beschikbaar is.',
    '',
  ];

  if (unique.length === 0) {
    lines.push(
      '(Geen nieuws opgehaald — controleer netwerk of probeer later opnieuw. Optioneel: stel NEWSAPI_KEY in voor extra bronnen.)',
    );
    return {
      headlines: [],
      digestText: lines.join('\n'),
      sourcesUsed,
      fetchedBeforeFilter: 0,
      headlinesTranslated: false,
    };
  }

  const impactRaw = filterHighImpactHeadlines(unique, { maxItems: 3, minScore: 3 });
  const { translations: nlTitles, usedLlm: headlinesTranslated } = await translateTitlesToNl(
    impactRaw.map((h) => h.title),
  );
  const impact: ScoredHeadline[] = impactRaw.map((h, i) => ({
    ...h,
    title: nlTitles[i] ?? h.title,
  }));

  if (impact.length === 0) {
    lines.push(
      '(Er is wel nieuws opgehaald, maar geen artikel voldoet aan het impactfilter — tijdelijk rustig op macro-/politiek-front volgens onze criteria.)',
    );
    return {
      headlines: [],
      digestText: lines.join('\n'),
      sourcesUsed,
      fetchedBeforeFilter,
      headlinesTranslated: false,
    };
  }

  for (let i = 0; i < impact.length; i++) {
    const h = impact[i];
    const when = h.publishedAt ? ` [${h.publishedAt}]` : '';
    const tags = h.impactCategories.length ? ` — ${h.impactCategories.join(', ')}` : '';
    lines.push(`${i + 1}. ${h.title}${when}${tags}`);
  }

  return {
    headlines: impact,
    digestText: lines.join('\n'),
    sourcesUsed,
    fetchedBeforeFilter,
    headlinesTranslated,
  };
}
