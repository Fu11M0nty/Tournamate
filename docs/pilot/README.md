# Pilot docs

Markdown is the **source of truth** here. The `.html`, `.docx`, and `.pdf` files are **generated exports** and are git-ignored — don't commit them, and don't hand-edit them (edit the `.md` and regenerate).

## Sources

| File | What it is |
|---|---|
| [`uk-netball-pilot-scope.md`](./uk-netball-pilot-scope.md) | Internal pilot scope & package (what's in/out). |
| [`pilot-onepager.md`](./pilot-onepager.md) | Plain-language one-pager to share with an organiser. |
| [`pilot-runbook.md`](./pilot-runbook.md) | Step-by-step operations runbook for running a pilot. |
| [`matchday-checklist.md`](./matchday-checklist.md) | Printable control-desk match-day checklist. |

## Regenerating the exports

**HTML only** (no dependencies, any OS) — regenerates `<doc>.html` for every source:

```bash
npm run docs:pilot
# or: node docs/pilot/_md2html.mjs
```

**HTML + DOCX + PDF** (Windows with Microsoft Word) — the shareable formats:

```powershell
pwsh docs/pilot/export-pilot-docs.ps1
```

For a one-off PDF without Word, open the generated `.html` in a browser and print to PDF.

The generator is [`_md2html.mjs`](./_md2html.mjs) — a small zero-dependency Markdown→HTML converter covering the subset of Markdown these docs use.
