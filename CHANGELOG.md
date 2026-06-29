# Changelog

## [1.12.0](https://github.com/haexhub/fwbg-dashboard/compare/v1.11.0...v1.12.0) (2026-06-29)


### Features

* unify Claude LLM config into one place on /ai ([#27](https://github.com/haexhub/fwbg-dashboard/issues/27)) ([0dc7f65](https://github.com/haexhub/fwbg-dashboard/commit/0dc7f65adadc0db56c70fe02d5d61ce3023c2120))

## [1.11.0](https://github.com/haexhub/fwbg-dashboard/compare/v1.10.1...v1.11.0) (2026-06-27)


### Features

* add Agents section for fwbg-agents monitoring and control ([0f4c344](https://github.com/haexhub/fwbg-dashboard/commit/0f4c344328d43583d756efbcaa08c928d8d8c286))
* add chart streaming, exploration, strategy sub-pages and settings improvements ([fe609e9](https://github.com/haexhub/fwbg-dashboard/commit/fe609e972700a8ebd0d70ce9fa978d85ad2b7e83))
* add chart, strategy, runs and plugins pages ([b08cf73](https://github.com/haexhub/fwbg-dashboard/commit/b08cf73951d80684a82e591b213c9c3a7b965866))
* add ChartStrategySave slideover component ([a9d9623](https://github.com/haexhub/fwbg-dashboard/commit/a9d96235ca3117d9b41b9d441337d63cb711744e))
* add column_group_labels to PluginInfo type ([d6582a6](https://github.com/haexhub/fwbg-dashboard/commit/d6582a6c038d6f79cc8af200df35b6042b9a1ddc))
* add datasources, presets, performance dashboard, range rectangles and run management ([dee86b1](https://github.com/haexhub/fwbg-dashboard/commit/dee86b1435c1547193c6c42b50fcc02b89942859))
* add drop_flat_bars toggle in datasource config ([1418dee](https://github.com/haexhub/fwbg-dashboard/commit/1418deeb784ba4064f97cd705af65a2766c13643))
* add entry modifier UI with dropdown and schema-based param fields ([9f22756](https://github.com/haexhub/fwbg-dashboard/commit/9f2275633d4b96abf02ec1c52d085f974d4fc3a0))
* add Kombinationen tab with synergistic feature pair analysis ([1cfa60f](https://github.com/haexhub/fwbg-dashboard/commit/1cfa60f39121cd070dca127289df51661e7aebf1))
* add Optimization tab with exit params grid and CT editor ([d8e2291](https://github.com/haexhub/fwbg-dashboard/commit/d8e22914c3c77f97f91f8fa4dd38290c9daeb19d))
* add save strategy button to chart toolbar ([19bc43e](https://github.com/haexhub/fwbg-dashboard/commit/19bc43e3a5d2806d161d38ed388b8094df35837a))
* add strategy update mode to chart save dialog ([26b2cdc](https://github.com/haexhub/fwbg-dashboard/commit/26b2cdc1538ece5e61c21985b647773c636fcb2d))
* AI assistant chat UI with FWBG tool integration ([7f91fe9](https://github.com/haexhub/fwbg-dashboard/commit/7f91fe934bd174d102d60599e1d80982734b3f15))
* always-visible add buttons in discovery, strategy selector in add modal ([7876eb4](https://github.com/haexhub/fwbg-dashboard/commit/7876eb4a4ed784117ada650ae9fc730e61745757))
* cancel running runs from detail view and runs list ([e0dff4c](https://github.com/haexhub/fwbg-dashboard/commit/e0dff4cc952b12e47819b3e12b95ea642d8d8556))
* chart indicator panel redesign, strategy save, preview trades ([3b1bc94](https://github.com/haexhub/fwbg-dashboard/commit/3b1bc94f85cb4fcbc953193fb072049a1476019c))
* chart pagination, range rect improvements, trade overlay fixes ([4c0b29e](https://github.com/haexhub/fwbg-dashboard/commit/4c0b29e3e118df9bf52478ed54fd2012b90e92f5))
* configurable days limit in preview panel ([a050db2](https://github.com/haexhub/fwbg-dashboard/commit/a050db237b42f90360a0b4d5227ae241d7cb7735))
* datasource transform config with data preview and batch prepare ([48333e7](https://github.com/haexhub/fwbg-dashboard/commit/48333e79c1ce89970cd91502dc06a01704811cc2))
* exit modifier dropdown UI, custom signals API ([a6d88bd](https://github.com/haexhub/fwbg-dashboard/commit/a6d88bd428066997e1e193e5f2975cbb7007ced2))
* feature discovery with SSE streaming, add-to-strategy, stat analysis ([1f77c0b](https://github.com/haexhub/fwbg-dashboard/commit/1f77c0b676bfbf9dffb29042106f95c77f87744e))
* groups-first config view with human-readable labels ([abe6af1](https://github.com/haexhub/fwbg-dashboard/commit/abe6af121b79dab79a5dc44ad999cd7ada9212e3))
* integrate signal rule editor into model tab ([d033d49](https://github.com/haexhub/fwbg-dashboard/commit/d033d4928bdc9ea22b3d4f399fd2dcfaec56ea39))
* merge chart/runs enhancements + strategy versioning ([5eb713c](https://github.com/haexhub/fwbg-dashboard/commit/5eb713c99972bb18073dbcf5605833d6599da819))
* model type select from available plugins ([40c768f](https://github.com/haexhub/fwbg-dashboard/commit/40c768f379d737cd51509d581175deb44ee8dc8e))
* MTF indicators, overlay columns, run progress monitoring, pagination ([b15afe5](https://github.com/haexhub/fwbg-dashboard/commit/b15afe5576a5deac6b86a2fa8ff8e8f803b234eb))
* multi-provider AI chat (Anthropic, OpenAI, Google, DeepSeek) ([2e2c2fc](https://github.com/haexhub/fwbg-dashboard/commit/2e2c2fcb436d4a08e6ca3646b4a3603d79a7faa5))
* pipeline preview — generate entry signals for first 60 days ([4cc489f](https://github.com/haexhub/fwbg-dashboard/commit/4cc489f0aaf265b6002973cc12c56d8534db9b5b))
* preserve chart scroll position when switching timeframe or source ([23bd35a](https://github.com/haexhub/fwbg-dashboard/commit/23bd35a0d390968801318f9b331180bebad2e9b1))
* sessions multi-select in ParamField, choice_labels support ([4148876](https://github.com/haexhub/fwbg-dashboard/commit/4148876c2d8d93913e8914250f785b8eacdb2391))
* signal composer types, API proxy, column composable ([5eda9c9](https://github.com/haexhub/fwbg-dashboard/commit/5eda9c9a5b51eb7dce1e49110e1df89fae206820))
* signal rule editor components (condition, group, editor) ([1301870](https://github.com/haexhub/fwbg-dashboard/commit/13018705fe03b0925a5597cc2cf5bcac9aa1e952))
* strategy versioning UI and workspace migration ([9dfaf3d](https://github.com/haexhub/fwbg-dashboard/commit/9dfaf3dae270117791e1b3174b1223e67ac1d1cf))
* surface Claude (haex-claude-proxy) connection status + login flow ([#24](https://github.com/haexhub/fwbg-dashboard/issues/24)) ([a8a1bee](https://github.com/haexhub/fwbg-dashboard/commit/a8a1beedec8266ba9500a53edced5980886c1e4c))
* trading sessions overlay for exchange open hours ([5a13c0d](https://github.com/haexhub/fwbg-dashboard/commit/5a13c0d85077868964781adb88c51e081ccad534))
* wire up strategy save slideover in chart view ([63edc3b](https://github.com/haexhub/fwbg-dashboard/commit/63edc3b0c72ce893a32afff7de42a17e56fc06b6))


### Bug Fixes

* add model/labeling keys to lanes record for type check ([460d9f0](https://github.com/haexhub/fwbg-dashboard/commit/460d9f04498024be886bff3714fdabac9ee9cdfc))
* add v-if guards on RunStartModal and VersionHistoryPanel to prevent undefined prop warnings ([3d7fb5f](https://github.com/haexhub/fwbg-dashboard/commit/3d7fb5f1c568b0cc38b24e2bee4267ed0885924f))
* correct timeframe, indicators and ORB zones when viewing runs ([141b878](https://github.com/haexhub/fwbg-dashboard/commit/141b878f05c314f096e2bb2ed605bb03d1e14987))
* disable SSR on run detail page to prevent hydration mismatches ([4382878](https://github.com/haexhub/fwbg-dashboard/commit/4382878f5300a29cfdfbdbe03443cad7a7c6493c))
* emit both plot and signal entries when opening strategy in chart ([3709bf8](https://github.com/haexhub/fwbg-dashboard/commit/3709bf8f5609ab63df8b952be8d1f4ebf1538b91))
* emit exit metadata through save event instead of mutating readonly prop ([f5dae00](https://github.com/haexhub/fwbg-dashboard/commit/f5dae001c42b39c9f0a4bec35f80781ea27a04a4))
* increase discovery proxy timeout to 5 min ([8614c21](https://github.com/haexhub/fwbg-dashboard/commit/8614c2138da5f2dd8b244bbe475cbec5b2ad96c7))
* load chart indicators only from URL, embed run indicators in link ([c330d8b](https://github.com/haexhub/fwbg-dashboard/commit/c330d8be41152baa5d640fe52a1627222ee62fde))
* merge plugin defaults into sidebar params for missing keys ([bb9c699](https://github.com/haexhub/fwbg-dashboard/commit/bb9c699bfeda0b652ea93cbbc036742837dd0691))
* migrate to @vue-dnd-kit/core 2.4.6 and klinecharts 10 breaking changes ([4d91c3f](https://github.com/haexhub/fwbg-dashboard/commit/4d91c3f28091763146887fc1823e2615bb557779))
* overnight range rects assign early-morning bars to previous day window ([e249f77](https://github.com/haexhub/fwbg-dashboard/commit/e249f77a8322f33ba3606fef99259e9d8e4d249a))
* pass route param name to PreviewPanel, not config.name ([5a10fe3](https://github.com/haexhub/fwbg-dashboard/commit/5a10fe3b3ba8d1f3f81c4afbba916a0c23648bae))
* pass timeframe to chart when opening from strategy builder ([7397ad0](https://github.com/haexhub/fwbg-dashboard/commit/7397ad0172635ed259c2e3fa180c5d26fa0d57e9))
* preserve signal indicator metadata in strategy roundtrip ([af1e865](https://github.com/haexhub/fwbg-dashboard/commit/af1e8652679b2d6ab75222c0cbdd48ce096ac8f4))
* preserve URL indicators param until restore completes ([d102e2b](https://github.com/haexhub/fwbg-dashboard/commit/d102e2bbfcbb9453d61ab0241b76a3fcd4418c97))
* preview endpoint falls back to runs/start when /api/preview not found ([9f18eb3](https://github.com/haexhub/fwbg-dashboard/commit/9f18eb330bf51ba8b3479abcb77f6276a7cf491e))
* preview panel uses strategy assets, fix TS errors ([5d7cbfc](https://github.com/haexhub/fwbg-dashboard/commit/5d7cbfc77296101d1c73d881a2d48962422c9e37))
* propagate loadTrades error, show chart link on error state ([d6a0182](https://github.com/haexhub/fwbg-dashboard/commit/d6a0182541985b108906845f9c161c1d9bec24d2))
* raise Node heap limit for the Nitro build step ([f1ae1a5](https://github.com/haexhub/fwbg-dashboard/commit/f1ae1a5983405afb2cb1d47a14dbeb417a4285d0))
* range visuals ([0adadea](https://github.com/haexhub/fwbg-dashboard/commit/0adadea0ba7960b6a3a96173f25ce8fe332430cd))
* remove orphaned try block in loadTrades (syntax error) ([dcf13cf](https://github.com/haexhub/fwbg-dashboard/commit/dcf13cf5898a6c4942a1f4b5c016776d30f0e243))
* remove stale preSelectGroupKey refs, add plugin descriptions to browse list ([5d524ce](https://github.com/haexhub/fwbg-dashboard/commit/5d524cecaca32294598c1e0b46af44a6005c685f))
* rename button label to Strategie aktualisieren ([ec1ca36](https://github.com/haexhub/fwbg-dashboard/commit/ec1ca367a66d6022b38dcb27dfdbd9c9a663f0f4))
* replace UDivider with USeparator in optimization tab ([b331716](https://github.com/haexhub/fwbg-dashboard/commit/b331716fb830eda764c2c0dc9761fb93026b4f65))
* resolve all TypeScript errors and remove small button/input sizes ([1edbb99](https://github.com/haexhub/fwbg-dashboard/commit/1edbb99b864b595f50d16f839c5747abe27e2163))
* resolve type errors in PluginConfigPanel and useStrategy ([9273d78](https://github.com/haexhub/fwbg-dashboard/commit/9273d78cfea82bcf9e42312ccfb60789ee9469d5))
* resolve TypeScript errors (zod v4, echarts formatter, null/undefined) ([72cfbbc](https://github.com/haexhub/fwbg-dashboard/commit/72cfbbc8b365d8bb4b126780effada2e89b1d564))
* show editor link in strategy save dialog when strategy is loaded ([d2cd32a](https://github.com/haexhub/fwbg-dashboard/commit/d2cd32a690c32de251bda199bf4f953d1f4514a7))
* trade marker positioning — UTC timestamp parsing and floor-snap ([b8b82c3](https://github.com/haexhub/fwbg-dashboard/commit/b8b82c366e2c2424c3712989fb74e3e85caa8d96))
* update grids.vue to use generic preset methods ([64a455a](https://github.com/haexhub/fwbg-dashboard/commit/64a455a0b3769a76b85fe823455a1ee117d9537f))
* use assets instead of asset_classes in preview proxy ([4c587a4](https://github.com/haexhub/fwbg-dashboard/commit/4c587a4d9e9e1a5cc8df41e1bbac765764da34bb))
* use manual index lookup + scrollToDataIndex for position restore ([fe4e881](https://github.com/haexhub/fwbg-dashboard/commit/fe4e881954623ab984c1a07a547b935fad0dbb94))
* use non-empty sentinel value for USelect 'all' options in LogViewer ([2a9a52d](https://github.com/haexhub/fwbg-dashboard/commit/2a9a52db234f6c16db585921336b2e329cb0c078))
* use Nuxt UI v4 USelect API (items/value-key) and add provider to model labels ([d4b0e18](https://github.com/haexhub/fwbg-dashboard/commit/d4b0e18d5b6ffefabe509876fe5b7b0a968bfdd7))
* use PnL-based equity simulation matching backend ([d6eb036](https://github.com/haexhub/fwbg-dashboard/commit/d6eb036706061eff1034a178410bc510d73a33bd))
* use requestAnimationFrame instead of setTimeout for scroll restore ([74f304e](https://github.com/haexhub/fwbg-dashboard/commit/74f304e40bbe69877636dfe0f7a323b4d099e403))
* use setTimeout for chart scroll restore after timeframe change ([fa5977f](https://github.com/haexhub/fwbg-dashboard/commit/fa5977fcba3b00ff8736ff28dff8eb42c5a5acc0))
* use splitNumber 5 in ScoreRadar to avoid ECharts tick readability warning ([4b5783e](https://github.com/haexhub/fwbg-dashboard/commit/4b5783e8e716648226648604efc50c22689279e2))
* vue-tsc missing devDependency + klinecharts 10 API break + test crash ([39a0c39](https://github.com/haexhub/fwbg-dashboard/commit/39a0c39e8df806a12c8c02d2fe1b8d3227e3c45b))
* wrap cancel button in ClientOnly to prevent SSR hydration mismatch ([c3820f6](https://github.com/haexhub/fwbg-dashboard/commit/c3820f60b2560744ddce8cacf6f06cabf0f8d35b))


### Performance Improvements

* adapt discovery UI for parallel backend, update AI SDK types ([8b3ff88](https://github.com/haexhub/fwbg-dashboard/commit/8b3ff888f7b5f99f469073d8c72394ff33200114))
