# Blueprint Ledger

## Run

Open **Blueprint Ledger.exe**. Keep this portable folder together. The app starts its local backend hidden and closes it with the window. It requires Windows x64, .NET Framework 4.8 and the Microsoft Edge WebView2 Evergreen Runtime. Node is bundled.

`Start.cmd` opens the EXE when available. Alternatively, run `npm start` for browser/server mode, or open `index.html` directly for standalone mode. Standalone browser storage is separate from the desktop app's `data/`; use backup/restore to transfer personal data. Screenshot OCR requires the Windows backend.

## Saved data

Your inventory, blueprint selections, crafting plans, locations and preferences are stored in `data/profile.json`. Export a backup from **Settings** before moving to another computer or resetting personal data. Preserve the entire `data/` folder. `selections.json` remains for legacy migration; it is not the current profile.

Catalogue updates retain selections by stable blueprint ID. Resource, component-grade and product-stat syncs are independent and keep the previous snapshot if a download fails. Catalogue snapshots remain available offline. Browser cache lives in `data/.desktop-cache/`.

## Use

- **Blueprints:** search and filter; mark Owned, Wanted or To craft. Marked includes Owned or Wanted. Expand a row for requirements. Bottom pagination stays visible.
- **Resources / Locations:** browse material properties, radar signatures and extraction locations. Resource detail pages link to blueprint requirements.
- **Owned resources:** add quantity in cSCU, quality and storage. Matching resource, quality and location stack together. Use +, −, Split / move or Delete on a tile. 100 cSCU = 1 SCU. Quality is an integer from 0 to 1000.
- **Screenshot import:** review and correct the OCR results before adding stock. Finished jobs use Quality + Quantity. Processing-job Done/Yield columns are available explicitly. OCR runs locally; screenshots are not uploaded.
- **Crafting:** select To craft on a blueprint. Assign the full ingredient quantity at a single quality; equal-quality stacks at different storage locations can supply it. Auto-assign uses the lowest eligible quality with enough stock. Item-count requirements are separate from cSCU stock. Assignments reserve stock across plans without consuming it; manually reduce stock after actual crafting.
- **Simulation:** sliders affect previews only. Quality 500 is neutral. Bonuses are green, penalties red; lower recoil and fuel use are beneficial. Each weapon mode has adjacent Base and Target/Final columns. Charged modes do not invent RPM or DPS. Burst DPS excludes cooldown. Missing bases are labelled relative/additive modifiers. Inconsistent source curves are re-anchored to neutral at 500 while retaining their quality-0 and quality-1000 endpoints; those estimates can differ from tools using the uncorrected curves.
- **Settings:** sync sources, inspect versions/status, export/restore backups, transfer configuration, undo the last stock change or reset personal data with confirmation. Configuration exports contain preferences and custom locations; use a full backup for stock and plans.

## Sources

- [SCCrafter catalogue and recipe modifiers](https://sccrafter.com/Blueprints.json). SCCrafter did not expose verified item deep links when inspected; the app links to its homepage and supports copying an item name.
- [SCMiner mineral directory](https://scminer.rocks/data/mineral-directory). Sync extracts the public embedded dataset without executing its scripts.
- [Star Citizen Wiki API](https://api.star-citizen.wiki/api/items) for component classes and grades.
- [SCMDB Fabricator](https://scmdb.net/?page=fab) for supplementary product bases. Sync selects its public LIVE crafting-item dataset. Supplementary and catalogue build versions can differ; versions appear in Settings. Unavailable detailed modes retain recipe-based estimates.

## Maintain

Runtime modules stay beside `server.mjs`; UI sources are in `public/`. Run `npm run build` after edits to regenerate both standalone HTML entry points. Both are intentional: root `index.html` is the standalone entry; `public/index.html` is served by the backend. No dependency installation is required.

Run `npm test` for the tests grouped in `tests/`, including catalogue-wide modifier coverage, quality baselines, weapon modes, stock operations and standalone persistence. The tests use isolated or in-memory data.

Desktop launcher source is in `desktop/`. Rebuild with `desktop/build.ps1 -SdkRoot <WebView2-SDK> -NodeExecutable <node.exe>`. SDK/runtime licences are in `licenses/`. Keep the EXE, its config, companion DLLs and `runtime/` in place. Old preview screenshots were removed; the development-test backup was preserved separately in `../blueprint-ledger-backups/`.

Desktop window: drag the header to move it; double-click it or use Maximize/Restore to change size. Resize from the outer edges. Minimize and Close are in the page header; Close retains the existing backend shutdown behaviour. These controls are hidden in ordinary browser mode. The EXE icon, header mark and favicon share the vector source in assets/. Credits appear in Settings: Made by Pooky.
