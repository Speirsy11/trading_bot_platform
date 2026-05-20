# Trading Bot Platform Focus

This product is intentionally narrowed to the three workflows that matter for an algorithmic crypto trading platform:

1. **Create and edit strategies** — expose a catalog of strategy templates with editable parameters and reusable risk presets.
2. **Backtest on collected candles** — test the exact strategy config against historical OHLCV data before launch.
3. **Run bots in paper or live mode** — promote validated configs to the bot runtime, using paper exchange simulation first and real exchange credentials only when explicitly selected.

## Competitive baseline

The current direction is modelled against the strongest parts of existing platforms:

- **TradingView**: strategies are first-class scripts that can be applied to charts and inspected through a Strategy Tester with simulated performance. This validates the need for strategy-centric navigation, chart context, and backtest reports. Source: <https://www.tradingview.com/pine-script-docs/concepts/strategies/>
- **Cryptohopper**: its Strategy Designer emphasises indicator/candlestick-pattern based strategy creation, and its backtesting flow tests bot templates with date ranges, checking speed, starting amount, and fees. This validates templates, parameter editors, and a clear path from strategy design to running bots. Sources: <https://support.cryptohopper.com/en/articles/9133482-what-is-the-strategy-designer-and-what-can-it-do>, <https://support.cryptohopper.com/en/articles/9013196-can-i-backtest-my-trading-bot>
- **3Commas**: its backtesting tooling highlights historical data breadth, indicator combinations, and multi-pair analysis before launching bots. This validates a backtest lab, market coverage visibility, and future multi-pair sweeps. Source: <https://3commas.io/backtesting>
- **Freqtrade**: its flow separates backtesting, dry-run/paper trading, and live trading, with the same strategy moving through each mode. This validates explicit run modes and safety warnings. Sources: <https://docs.freqtrade.io/en/latest/backtesting/>, <https://docs.freqtrade.io/en/latest/bot-usage/>
- **Hummingbot**: its strategy framework uses configurable templates, scripts/controllers, market data providers, and live bot execution against exchanges. This validates reusable templates and runtime strategy abstractions. Sources: <https://hummingbot.org/strategies/>, <https://hummingbot.org/strategies/v2-strategies/controllers/>

## Implemented in this pass

- Added a dedicated `/strategies` workbench for catalog browsing, templates, editable strategy parameters, and direct links into backtesting or bot creation.
- Added an API `strategies` router that exposes catalog metadata, launch presets, config validation, warnings, and strategy explanations.
- Refocused `/backtest` into a research lab with strategy catalog integration, parameter editing, data coverage, realistic execution settings, and validation warnings.
- Refocused `/trading` into a chart + algorithm launchpad, removing manual single-order placement from the primary UX.
- Updated bot creation to use canonical strategy keys, paper/live run modes, and strategy links from the new workbench.
- Updated navigation labels so the app reads as `Strategies → Backtest → Live Runs`, not a generic trading terminal.

## Next product parity targets

- Save custom strategy drafts to the database instead of relying only on catalog templates.
- Add visual/no-code rule blocks for indicator conditions.
- Add backtest comparison views, parameter sweeps, and multi-pair runs.
- Add explicit promotion from a successful backtest result into a pre-filled paper bot.
- Add live-readiness checklist: exchange credentials, market data freshness, risk caps, and paper-trading history.
