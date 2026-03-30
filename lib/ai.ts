import Anthropic from '@anthropic-ai/sdk';
import { TRADE_PAIRS } from '@/lib/crypto-pairs';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type TradingAnalysisParams = {
  pair: string;
  timeframe: string;
  riskLevel: string;
  additionalContext?: string;
  /** Binance koers + RSI + MACD-stijl trend voor het gekozen paar */
  marketDataBlock?: string;
  /** Optioneel: headlines (macro/crypto) */
  newsDigestBlock?: string;
};

export function buildTradingPrompt(params: TradingAnalysisParams): string {
  const marketSection =
    params.marketDataBlock?.trim() ?
      `\n## Live marktdata (Binance, indicatoren op gekozen timeframe)\n${params.marketDataBlock.trim()}\n`
      : '';
  const newsSection =
    params.newsDigestBlock?.trim() ?
      `\n## Recente nieuws- & macro-headlines\n${params.newsDigestBlock.trim()}\n`
      : '';

  return `Analyseer het volgende crypto-handelsscenario en geef een volledige, uitvoerbare strategie. Baseer je technische inschatting primair op de live marktdata hieronder wanneer die aanwezig is; gebruik headlines alleen waar ze relevante context toevoegen. Schrijf de volledige analyse in het Nederlands.

**Handelspaar:** ${params.pair}
**Timeframe:** ${params.timeframe}
**Risiconiveau:** ${params.riskLevel}
${params.additionalContext ? `**Extra context:** ${params.additionalContext}` : ''}
${marketSection}${newsSection}
Structureer je analyse met de volgende secties (koppen exact zo gebruiken):

## 1. Marktanalyse
Beschrijf de huidige marktomstandigheden, trendrichting, momentum en belangrijke support/resistance voor ${params.pair} op het ${params.timeframe}-timeframe. Geef aan of de markt trendend, rangebound is of bij een mogelijk keerpunt.

## 2. Instapstrategie
- Primair instappunt en voorwaarden om te triggeren
- Bevestigingssignalen om op te wachten vóór instap
- Aanbevolen ordertype (market, limit, stop-limit)

## 3. Exitstrategie
- **Take profit:** concrete doelniveau(s) met onderbouwing
- **Stop loss:** plaatsing met reden
- **Risk/reward:** berekende R:R voor deze setup

## 4. Risicobeheer
- Voorgestelde positiegrootte als % van portfolio gegeven ${params.riskLevel} risico
- Maximaal acceptabel verliesscenario
- Voorwaarden die deze setup ongeldig maken

## 5. Belangrijke technische indicatoren
Noem 3–5 meest relevante indicatoren om te volgen en welk signaal elk moet geven voor tradebevestiging.

## 6. Vertrouwensbeoordeling
**Vertrouwensniveau: Laag / Gemiddeld / Hoog**

Korte onderbouwing van je vertrouwen, inclusief belangrijke risico’s of marktomstandigheden die deze strategie kunnen beïnvloeden.

Wees concreet en praktisch. Gebruik waar mogelijk harde cijfers.`;
}

export type MultiPairSignalsParams = {
  timeframe: string;
  riskLevel: string;
  additionalContext?: string;
  /** Binance-koersen + RSI + MACD-stijl trend */
  marketDataBlock?: string;
  /** Geaggregeerde headlines (macro, crypto, etc.) */
  newsDigestBlock?: string;
};

export function buildMultiPairSignalsPrompt(params: MultiPairSignalsParams): string {
  const pairsList = TRADE_PAIRS.join(', ');
  const marketSection =
    params.marketDataBlock?.trim() ?
      `\n## Actuele marktdata (Binance, technische indicatoren)\n${params.marketDataBlock.trim()}\n`
      : '';
  const newsSection =
    params.newsDigestBlock?.trim() ?
      `\n## Recente nieuws- & macro-headlines\n${params.newsDigestBlock.trim()}\n`
      : '';

  return `Je bent een crypto-analist. Gebruik de onderstaande marktdata en headlines waar relevant — geef voor ELK van de volgende paren precies één handelsignaal. Leg in de rationale kort uit of je vooral op techniek (RSI, trend), koersbeweging 24u, of nieuws/macro leunt.

**Timeframe analyse:** ${params.timeframe}
**Risiconiveau:** ${params.riskLevel}
${params.additionalContext ? `**Extra context van gebruiker:** ${params.additionalContext}` : ''}
${marketSection}${newsSection}
**Paren (exact deze labels gebruiken):** ${pairsList}

Antwoord uitsluitend met geldige JSON (geen markdown, geen tekst eromheen) in dit formaat:
{
  "signals": [
    {
      "pair": "BTC/EUR",
      "signal": "BUY",
      "confidence": "Medium",
      "rationale": "Korte zin met reden."
    }
  ]
}

Regels:
- "signal" is altijd één van: BUY, SELL, HOLD.
- "confidence" is één van: Low, Medium, High.
- "rationale": maximaal 1–2 zinnen, altijd in het Nederlands.
- Het array "signals" moet precies ${TRADE_PAIRS.length} objecten bevatten, één per paar, met "pair" exact zoals in de lijst hierboven.

Disclaimer: dit is geen financieel advies; signalen zijn educatief.`;
}
