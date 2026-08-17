## Building with @convolens/ui

This is a shadcn/ui-style primitives kit: Radix UI behavior + Tailwind
utility classes composed via `class-variance-authority` (CVA) variants and
merged with `cn()` (clsx + tailwind-merge). There is no CSS-in-JS and no
prop-driven theming API — style by **applying Tailwind classes**, the same
way the components style themselves internally.

### Wrapping and dark mode

No provider is required for static styling. Dark mode is a **class on an
ancestor element**, not a runtime context: add `class="dark"` to the
element wrapping your composition (matches `tailwind.config`'s
`darkMode: ["class"]`) and every token-driven utility below repaints
automatically — no JS toggle needed unless you also want live switching.
`ThemeProvider` (wraps `next-themes`) exists for that live-toggle case only;
skip it for a static design.

Every component accepts `className` and merges it via `cn()` — pass classes
directly on the component, don't fight it with `!important` or wrapper divs.

### The styling vocabulary — semantic color pairs

Colors are HSL custom properties consumed through Tailwind's semantic color
family, always as a `{name}` / `{name}-foreground` pair:

| Family | Background | Foreground/text |
|---|---|---|
| Primary action | `bg-primary` | `text-primary-foreground` |
| Secondary action | `bg-secondary` | `text-secondary-foreground` |
| Destructive | `bg-destructive` | `text-destructive-foreground` |
| Muted | `bg-muted` | `text-muted-foreground` |
| Accent (hover/highlight) | `bg-accent` | `text-accent-foreground` |
| Popover/menu surface | `bg-popover` | `text-popover-foreground` |
| Card surface | `bg-card` | `text-card-foreground` |
| Page | `bg-background` | `text-foreground` |

Structural: `border-input` (form field borders), `ring-ring` (focus rings).
Card and similar surfaces use plain `border` (Tailwind's default gray, not
a `--border`-token class — this DS never generated a `border-border`
utility, so don't reach for one). Radius: `rounded-lg` / `rounded-md` /
`rounded-sm` scale off the single `--radius` token — use these instead of
arbitrary `rounded-[Npx]` values to stay on-system.

**One deliberate exception**: `Button`'s `variant="primary"` is a literal
brand-green (`bg-green-600`), not the `--primary` token (which is actually
purple). Reach for `variant="default"` when you want the semantic primary
color; use `variant="primary"` only when the WhatsApp-brand green itself is
the intent.

### Where the truth lives

`styles.css` `@import`s `_ds_bundle.css`, which is this DS's **one compiled
stylesheet** — it carries every token (`--background`, `--primary`, etc.)
and all component CSS; there's no separate `tokens/*.css` split. Read it
before styling anything non-obvious. Per component,
`components/primitives/<Name>/<Name>.prompt.md` has real usage examples;
`<Name>.d.ts` has the exact prop surface.

### Example

```jsx
const { Card, CardHeader, CardTitle, CardContent, Input, Label, Button } = window.ConvolensUi;

<Card className="w-full max-w-md">
  <CardHeader>
    <CardTitle>Forgot your password?</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" placeholder="m@example.com" />
    </div>
    <Button className="w-full">Send reset link</Button>
  </CardContent>
</Card>
```
