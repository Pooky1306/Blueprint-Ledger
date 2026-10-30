# Blueprint Ledger

**A local Star Citizen blueprint, resource and crafting planner.**

Made by **Pooky**.

Keep track of the blueprints you own or want, record your collected resources, and plan what to craft—all in a compact interface designed with touchscreen use in mind.

## Features

- **Blueprint catalogue:** search, category/type filters, component class and grade, and Owned / Wanted / To craft tags.
- **Resource database:** rarity colours, radar signatures and multipliers, mining properties, and extraction locations.
- **Owned resources:** quantities in cSCU, quality and storage locations, with stacking, quantity adjustments, splitting and moving.
- **Refinery screenshot import:** local Windows OCR with a review step before anything is added.
- **Crafting planner:** ingredient shortages, full-quantity assignments at a single quality, and stock reservations across plans.
- **Stat simulation:** quality sliders and base/final comparisons, including separate weapon fire-mode columns.
- **Local storage:** personal data stays on your computer. JSON backup/restore and configuration import/export are available in Settings.
- **Independent syncs:** update blueprints, minerals, component grades and supplementary product statistics without losing personal selections.

## Run the Windows app

1. Download **Blueprint-Ledger-Windows-x64.zip** from this repository's **Releases** section.
2. Extract the entire ZIP into a writable folder.
3. Open **Blueprint Ledger.exe**.

Keep the folder together: the EXE needs its bundled runtime, companion DLLs and data files. Closing the window also closes the backend.

Requires **Windows x64**, **.NET Framework 4.8** and **Microsoft Edge WebView2 Evergreen Runtime**. Node is included in the portable release. The release starts with an empty personal inventory.

## Run from source

With Node.js 20 or later installed:

```sh
npm start
```

The browser version runs locally at `http://127.0.0.1:8765`. No npm packages need to be installed. For an offline standalone view, open `index.html`; its browser storage is separate from the desktop/server inventory. OCR requires the Windows backend.

After editing UI sources, run `npm run build`. Run `npm test` for the automated checks. Desktop launcher source and build instructions are in `desktop/` and [the app notes](APP-NOTES.md).

## Save and back up

Desktop/server inventory lives in `data/profile.json`. Use **Settings → Export backup** before updating or moving the app. When replacing an installation, preserve your existing personal profile. Never upload your personal profile, exported backups or browser cache to this repository.

## Tester notes

This is a work in progress. Please report the blueprint/material name, the steps that caused a problem, and a screenshot when useful. Include catalogue and product-data versions from Settings for stat discrepancies.

- Stat previews are estimates based on published game data. Missing absolute bases are shown as relative modifiers.
- Quality 500 is treated as neutral. Inconsistent source curves are re-anchored to that midpoint; those estimates can differ from other tools.
- Detailed fire modes depend on available source data. Burst DPS excludes cooldown; charged modes do not invent RPM or DPS.
- OCR results need manual review.
- Crafting reserves stock but does not consume it automatically. Reduce stock manually after crafting in-game.

## Data sources and acknowledgements

- [SCCrafter](https://sccrafter.com/) — blueprint catalogue, ingredients and crafting modifiers.
- [SCMiner](https://scminer.rocks/) — mineral data and extraction locations.
- [Star Citizen Wiki API](https://api.star-citizen.wiki/) — component classes and grades.
- [SCMDB](https://scmdb.net/) — supplementary product statistics and UI inspiration.

Third-party runtime licences and notices are included in `licenses/`. Blueprint Ledger is an unofficial fan tool and is not affiliated with Cloud Imperium Games.
