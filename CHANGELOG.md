## v1.1 Stable Release Candidate — Particle Edge Wrap Fix (pending Windows acceptance)

- Устранён длинный след через весь экран при пересечении границы canvas быстрыми частицами: при переносе координат на противоположную сторону кадр не соединяет старую и новую точки.
- Скорости, формы, палитра, число частиц, короткие следы и обычное движение остаются прежними.
- Добавлен исполняемый регрессионный тест границ (лево, право, верх, низ), обычного движения и сохранения offscreen-буфера.
- Утверждённый Hotfix 4 сохранён во всём остальном; Windows GUI/visual acceptance для обновлённого исходника ещё требуется.

## Igroteka v1.1 Stable — Promotion from accepted Startup Preview 1 Hotfix 4

- Windows-accepted UI and logic frozen without changes to `app/` or `src-tauri/src/`.
- Version synchronized to 1.1.0 across npm, Cargo, Tauri and lock files.
- Stable release pipeline now refuses to overwrite existing Release/Artifacts, verifies ZIPs after extraction, and emits SHA-256.
- Accepted Hotfix 4 code and canonical SQLite sealed by source SHA-256 checks.
- Native Windows release build and runtime acceptance remain required before publication.

## Startup & Titlebar Preview 1 — Hotfix 1: Close & Particle Crossfade

- Fix silent window close failures, add safe persistence confirmation on error/timeout and native invoke error visibility.
- Prewarm and crossfade the full-spectrum particle canvas underneath the existing splash.
- No changes to Tauri geometry, SQLite, particle count/visuals or the Stable release.

## v1.0 Theme Preview 1 Hotfix 3 — Centered Rating Menus

- Themed dropdown menus now open horizontally centered on their trigger instead of being anchored to the trigger's left edge.
- Positioning uses the menu's actual rendered width, so rating menus with CSS `min-width` stay visually centered.
- The centered position is clamped to an 8px viewport edge margin, preventing menus from escaping off the left or right side.
- Applies consistently to table rating/status menus and other themed selects; keyboard navigation and top/bottom flip behavior are unchanged.
- Hotfix 1 no-pause command policy and Hotfix 2 runtime true-black background chain remain intact.

## v1.0 Theme Preview 1 Hotfix 2 — Runtime True Black

- Fixed the actual remaining purple background source: `app/shared/igroteka-bridge.js` forced `#08070d` onto `document.documentElement` at runtime with `important`, overriding the Cinema Mono CSS.
- Runtime root background, startup route overlay and legacy base `--bg` are now canonical `#020203`.
- Bootstrap failure screen now also uses `#020203`, so fallback rendering cannot reintroduce the purple-black wash.
- Added verifier guards that reject legacy `#08070d` in active frontend background surfaces.
- No-pause command-wrapper policy from Hotfix 1 remains intact.

## v1.0 Theme Preview 1 Hotfix 1 — True Black Native Window + No-Pause Commands

- Native Tauri window background changed from legacy purple-black `#08070d` to canonical Cinema Mono `#020203` in DEV and release configs.
- This removes the purple wash visible through the transparent page root before/around WebView composition.
- Removed interactive `pause` lines from BUILD-DEV.cmd, BUILD-RELEASE.cmd, MAKE-FINAL-RELEASE.cmd and MIGRATE-FROM-LOST-HEAVEN.cmd.
- Added verifier guards for the true-black native window and non-interactive command wrappers.

# Changelog

## v1.0 Theme Preview 1 — Cinema Mono Parity

- Игротека переведена на подтверждённый визуальный язык Kinoteka Cinema Mono без изменения SQLite/Rust/бизнес-логики.
- Фон стал true-black; старый фиолетовый starfield заменён полноцветными Living Particles с плавным hue-cycle, более плотным распределением, glint-крестиками и короткими streak-эффектами.
- Таблица, неактивная статистика, поиск, модалки и поля получили мягкие полупрозрачные graphite surfaces. `backdrop-filter` на интерактивных/анимируемых поверхностях принудительно отключён для WebView2 compositor safety.
- Неактивные статистические карточки стали монохромными; цвет рейтинга появляется на hover/active. Игровой статус «Прохожу» сохраняет собственный фиолетовый semantic accent.
- Главная кнопка добавления, Reset, пагинация, Restore и Close переведены в бело-графитовую систему; красный оставлен для удаления/очистки корзины.
- Add Game и rating dropdowns получили neutral chrome + contextual semantic accents; favorite остаётся золотым. Rating popup расширен до комфортной ширины.
- Titlebar переведён на полупрозрачный near-black chrome без backdrop blur.
- Verifier получил отдельные Theme Preview 1 guards; версия и release identity v1.0 Stable намеренно не менялись до визуального подтверждения.


## v1.0 Stable — Stable Promotion

- Подтверждённый Windows RC1 promoted в Stable без изменений UI, JS-логики приложения, Rust/SQLite и CSS.
- Версия синхронизирована `1.0.0-rc.1` -> `1.0.0` в package/Cargo/Tauri/lock-файлах и release metadata generator.
- Release channel переведён с `Release Candidate` на `Stable`; release label — `v1.0 Stable`.
- Имена release/portable/source артефактов переведены с `Igroteka_Standalone_v1.0_RC1` на `Igroteka_Standalone_v1.0_Stable`.
- Строгий Portable allowlist, canonical SQLite checks, locked Cargo pipeline, ZIP re-extract verification и SHA-256 release manifest сохранены без функциональных изменений.


## Post-v0.2 — UI Freeze / Legacy Cleanup Pass 8

- Канонические live/seed SQLite нормализованы: из `settings.uiState` удалён уже retired-ключ `duplicateOnly`; коллекция игр, корзина, metadata/revision не менялись.
- После нормализации БД удалён временный runtime compatibility-branch, который очищал `duplicateOnly` при каждом новом source/portable запуске.
- Внутренний browser-guard expando `__lhBrowserGuardInstalled` переведён в standalone namespace `__igrotekaBrowserGuardInstalled`.
- Активные комментарии browser-guard/themed-select очищены от устаревшей Lost Heaven terminology без изменения поведения или CSS-значений.
- Migration tooling и стабильный Tauri identifier `com.lostheaven.igroteka` намеренно сохранены: они не являются активным UI/runtime legacy.
- Verifier получил Pass 8 guards для canonical UI-state и отсутствия Lost Heaven runtime tokens внутри `app/`.

## Post-v0.2 — UI Freeze / Legacy Cleanup Pass 7

- Завершён активный frontend namespace cleanup для themed-select: `lh-select-*` и `lh-native-select-source` заменены на `igroteka-select-*` / `igroteka-native-select-source`.
- CSS custom properties themed-select переведены с `--lh-select-*` на `--igroteka-select-*`; значения цветов, размеров, borders и состояния dropdown не менялись.
- Типографические custom properties `--lh-*` в `styles.css` получили standalone `--igroteka-*` имена без изменения значений.
- Комментарии активного runtime/fonts слоя приведены к terminology Игротеки; исторический changelog и migration tooling намеренно сохранены.
- `com.lostheaven.igroteka` не менялся: Tauri identity вынесен за рамки UI cleanup, чтобы не создавать риск совместимости.
- Verifier получил Cleanup Pass 7 guards: активный `app/` больше не должен возвращать `lh-select-*`, `lh-native-select-source` или `--lh-*`.

## Post-v0.2 — UI Freeze / Legacy Cleanup Pass 6

- Остаточный startup-shell отвязан от активных Lost Heaven runtime-имён: route reveal, particle canvas и titlebar host получили `igroteka-*` namespace.
- `window.lhRouteTransition` заменён на минимальный `window.igrotekaRouteTransition`; недостижимые multi-route `handoff` / leaving-state ветки удалены.
- В themed-select переименованы только внутренние expando/dataset/menu-id поля (`_igrotekaSelect*`, `data-igroteka-*`); активные визуальные классы `lh-select-*` и CSS variables `--lh-*` намеренно сохранены без изменений.
- Исторические `lh-*` id inline-style блоков заменены нейтральными `igroteka-*`; визуальные CSS-свойства не менялись.
- Удалены два доказанно неиспользуемых значения: `oldStatus` и `TRASH_MODAL_CLOSE_MS`.
- Комментарии затронутых startup-shell блоков приведены к standalone Igroteka terminology; историческая документация миграции из Lost Heaven сохранена.
- Verifier получил Cleanup Pass 6 guards для нового startup-shell namespace и сохранения действующего themed-select visual contract.

## Post-v0.2 — UI Freeze / Legacy Cleanup Pass 5

- Удалены устаревшие synchronous fallback API записи (`replaceGamesSync`, `moveGameToTrashSync`, `restoreTrashSync`, `permanentlyDeleteTrashSync`, `emptyTrashSync`).
- Текущий standalone frontend теперь всегда использует подтверждённые async SQLite writes для списка игр и всех destructive Trash-операций.
- Удалены неиспользуемые `replaceTrashSync`, `__flush`, `trashComparable` и внутренний `persist` helper, который обслуживал только старые fallback-пути.
- UI-state persistence (`replaceUISync`) сохранён отдельно: это неблокирующие настройки интерфейса, а не destructive game-data write.
- Визуальный CSS, titlebar, modal system, route transition, themed-select, Rust/SQLite schema и обе базы данных не менялись.
- Verifier получил Cleanup Pass 5 guards против возврата unconfirmed compatibility write paths.

## Post-v0.2 — UI Freeze / Legacy Cleanup Pass 4

- Активные JS globals отвязаны от Lost Heaven: `window.LHModal`/`window.LHDialog`/`window.lostHeaven` заменены standalone-именами `window.IgrotekaModal`/`window.IgrotekaDialog`/`window.igrotekaRuntime`.
- Script-global modal controllers переименованы в `addGameModalController` / `trashModalController`; неиспользуемый confirm-controller больше не сохраняется в переменную.
- Native-dialog runtime получил standalone CSS/DOM namespace `igroteka-*`; fallback title теперь «Игротека».
- `modal-system.css` сокращён до реально существующей standalone DOM-модели `.modal-backdrop` + `.modal`; удалены старые year/editor/delete/trashDialog/Lost-Heaven selector arms.
- Из `styles.css` удалены мёртвые `.trashModal` class arms; реальный `#trashModal.modal-backdrop` не менялся.
- Titlebar, route transition, particle canvas, themed-select `lh-*`, SQLite/Rust backend и визуальный CSS интерфейса намеренно не переименовывались.
- Verifier получил Cleanup Pass 4 guards на новый standalone runtime namespace и отсутствие удалённых modal legacy-токенов.

## Post-v0.2 — UI Freeze / Legacy Cleanup Pass 3

- Удалён недостижимый `duplicateOnly` state/filter branch; старые сохранённые UI-state автоматически нормализуются без этого ключа.
- Сохранены действующие `quickFilter`, поиск и скрытый persisted sort; сортировочная логика намеренно не удалялась.
- Из CSS удалены standalone-недостижимые selector families старых sort/page-size/delete/add-choice/filter-chip/history-list/server-status элементов.
- Активные Trash `history-modal` / `history-note`, pagination, favorite, rating, Add Game и titlebar правила сохранены.
- Verifier получил Cleanup Pass 3 guards против возврата `duplicateOnly` и удалённых dead selector families.

## Post-v0.2 — UI Freeze / Legacy Cleanup Pass 2

- Схлопнуты исторические поколения reset-анимаций: рабочей остаётся только текущая V832.
- Удалены недостижимые Trash activation/deactivation поколения V841–V844; runtime использует текущую V849 transition/dot-схему.
- Удалены дубли размеров/геометрии Trash modal; финальный v1.88-блок сохранён как канонический.
- Favorite control в Add Game приведён к одному правилу без hover-zoom, сохранив утверждённый внешний вид.
- Дубли inline space-background сокращены без изменения порядка каскада; `contain:strict` и route overlay contract сохранены.
- Verifier получил Cleanup Pass 2 guards против возврата удалённых исторических CSS-поколений.
- Titlebar, SQLite/Rust backend, rating UI, текущие modal/trash transitions и визуальная геометрия приложения не перерабатывались.

## Post-v0.2 — UI Freeze / Legacy Cleanup Pass 1

- Удалён неиспользуемый legacy delete-modal; рабочее удаление через текущий context-delete / SQLite trash flow сохранено.
- Удалены скрытые legacy `stats` / `toast` элементы и их мёртвые расчёты.
- Удалены no-op compatibility aliases, `fillFilters`, `formatHistoryDate`, старый `writeTrash` и другие доказанно неиспользуемые функции.
- Удалены Budget/Kinoteka branches из standalone themed-select и CSS-алиасы `Смотрю`, `game-entry-category`, `game-entry-year`.
- Динамический Lucide subset сокращён до реально вызываемых иконок.
- Verifier получил отдельные Cleanup Pass 1 guards против возврата удалённого dead code / foreign selectors.
- Утверждённый titlebar, current Add Game, Trash, rating UI, particle background и active `lh-*` infrastructure не менялись.

## v0.2 Preview — Reliability & Finalization

- Подтверждённое сохранение: UI ждёт завершения Rust/SQLite transaction перед успешным статусом.
- Устранён ложный in-memory round-trip как доказательство дискового сохранения.
- Усилен portable data-root: обычная portable-копия работает только со своими соседними `data` / `seed-data`.
- Source-root разрешён только для фактического Cargo build-tree.
- Startup failure показывает отдельный recovery/error screen и сохраняет доступ к titlebar.
- Космический фон ограничен 90 FPS и останавливается при `document.hidden`.
- Удалён избыточный глобальный drag MutationObserver.
- Исправлен `$running.Count` в PowerShell 5.1 миграторе.
- Добавлены clean Release и Final Release pipelines.
- Добавлены Portable/Source ZIP, re-extract verification, SHA-256 manifest и release metadata.
- Verifier расширен контрактами v0.2.
- Версии package/Cargo/Tauri синхронизированы на 0.2.0.

## v0.1 Preview

- Игротека отделена от Lost Heaven Desktop в самостоятельный Tauri-проект.
- Отдельные application identifier, window title, single-instance mutex и EXE.
- Отдельная portable SQLite `data/igroteka.sqlite3`.
- Автоматические резервные копии ограничены 20 экземплярами.
- Recovery использует: live DB -> последний валидный backup -> seed.
- Удалены backend-команды Кинотеки и Бюджета.
- Сохранён интерфейс Игротеки из переходной ветки Lost Heaven.
- Добавлен инструмент миграции текущей базы из Lost Heaven.
- Hotfix 1: PowerShell 5.1-safe migration encoding.
- Hotfix 2: отдельный standalone titlebar без левой иконки, центрированный заголовок, window buttons on hover.


## Startup & Titlebar Preview 1 (2026-10-09)
- Early titlebar + gamepad splash, hover-only controls, data-ready fade.
- Original Windows geometry and Rust show sequence unchanged.
- Isolated GUI-Subsystem Preview packaging, guarded original Stable release.

## Startup Preview 1 Hotfix 2 — Responsive Close
- Close now invokes native Tauri immediately when no SQLite writes are outstanding.
- During an in-flight write, a visible busy state and 800ms timeout precede explicit unsaved-data confirmation.
- No changes to native geometry, startup animation, particles, or canonical databases.

## Startup Preview 1 Hotfix 4 — Reset & WebView Edge Handoff
- Reset now follows Kinoteka v1.1 Stable fade-to-disabled lifecycle, with a reduced-motion path and timeouts.
- Narrow titlebar hit-test fallback routes only trusted WebView-received clicks adjacent to close to the existing guarded close handler. Native border interception is not yet solved.
- No changes to native window geometry, Rust, startup transition, particles or databases.
