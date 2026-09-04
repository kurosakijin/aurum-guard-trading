# Aurum Guard reading and data list

These are references to study, not copied book datasets. Copyrighted books should
not be scraped into a model, and prose is not a substitute for timestamped market
data, realistic costs, chronological validation, and forward demo testing.

## Books

- **[Evidence-Based Technical Analysis — David Aronson](https://onlinelibrary.wiley.com/doi/book/10.1002/9781118268315) (Wiley).** Useful for
  hypotheses, data-mining bias, statistical testing, and separating a story from
  evidence.
- **[The Art and Science of Technical Analysis — Adam Grimes](https://onlinelibrary.wiley.com/doi/book/10.1002/9781119202837) (Wiley).** Useful for
  market structure, trends, pullbacks, ranges, and discretionary chart context.
- **[Advances in Financial Machine Learning — Marcos López de Prado](https://www.wiley.com/en-us/Advances+in+Financial+Machine+Learning-p-9781119482109) (Wiley).** Useful
  for leakage-aware labels, purged validation, and financial ML research design.
- **Trading and Exchanges — Larry Harris (Oxford University Press).** Useful for
  spreads, liquidity, order types, execution, and why a chart signal differs from
  a real fill.

Use the publisher or a library copy. The package does not reproduce their text.

## Datasets

- **Your MT5 broker history:** best match for the exact XAUUSD/XAGUSD symbols,
  spreads and session conventions used by the EA. The included builder exports a
  learning CSV from a frozen snapshot.
- **CME DataMine:** authoritative historical futures data for COMEX Gold and
  Silver; check licensing and fees before use.
- **CFTC Commitments of Traders:** free weekly positioning context. It is slow
  macro context, not an M1 trigger.
- **FRED:** macro series such as rates, inflation and dollar measures. Release
  timestamps and revisions must be handled to prevent hindsight leakage.

For risk education, see the [NFA investor best practices](https://www.nfa.futures.org/investors/investor-resources/files/investor-best-practices.html).

More data is not automatically better. Symbol definitions, timestamps, revisions,
costs, missing bars, and licensing must be documented before training.
