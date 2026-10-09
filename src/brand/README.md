# @noorai/brand

> Copied from NoorAI Lab Studio `packages/brand` (stage 1.4, 2026-09-29). Do not edit here; update it there and copy it again.

The NoorAI brand as files the web app imports. Nothing here loads from the internet.

| File | What it is |
| --- | --- |
| `tokens.css` | Colour, space, radius and font-family tokens, light and dark. Exactly as in `docs/BUILD_GUIDE.md` |
| `type.css` | The type scale as `--text-*` variables, with Urdu (Nastaliq) versions that switch on under `html[lang="ur"]` |
| `fonts/` | Public Sans, Noto Nastaliq Urdu and JetBrains Mono (woff2, SIL Open Font License) and `fonts.css` |
| `logo/` | The Book of dawn mark: full colour, reverse, mono and small |
| `design-system/` | Reference copy of the NoorAI Design System. Rebuilt in `apps/web/src/components`; not imported |

Use it from the web app:

```css
@import "@noorai/brand/fonts.css";
@import "@noorai/brand/tokens.css";
@import "@noorai/brand/type.css";
```
