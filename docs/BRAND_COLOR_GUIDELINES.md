# ConvoLens Brand Color Guidelines

## Color Palette

### Primary Brand Colors (ConvoLens)

Use these colors for all general branding, UI elements, and platform features:

- **Deep Purple** (`#6B46C1`) - Primary brand color
  - Use for: Primary buttons, links, headers, brand elements, CTAs
  - HSL: `262° 83% 58%`
  - RGB: `107, 70, 193`

- **Bright Cyan** (`#06B6D4`) - Secondary brand color
  - Use for: Secondary buttons, accents, hover states, highlights
  - HSL: `191° 91% 45%`
  - RGB: `6, 182, 212`

- **Soft Lavender** (`#C4B5FD`) - Accent color
  - Use for: Subtle backgrounds, borders, light accents, gradients
  - HSL: `266° 100% 88%`
  - RGB: `196, 181, 253`

### WhatsApp Integration Colors

Use these colors **ONLY** for WhatsApp-specific features and indicators:

- **WhatsApp Green** (`#25D366`) - WhatsApp primary
  - Use for: WhatsApp chat indicators, WhatsApp connection status, WhatsApp-specific badges
  - Use when: Indicating WhatsApp-sourced data or WhatsApp-specific functionality
  - HSL: `142° 76% 36%`
  - RGB: `37, 211, 102`

- **WhatsApp Dark Green** (`#128C7E`) - WhatsApp secondary
  - Use for: WhatsApp hover states, darker WhatsApp elements
  - HSL: `174° 82% 31%`
  - RGB: `18, 140, 126`

## Usage Guidelines

### When to Use ConvoLens Colors

✅ **Always use ConvoLens colors for:**

- Main navigation and menus
- Primary and secondary buttons
- Links and interactive elements
- Page headers and titles
- Dashboard elements
- Data visualizations (unless WhatsApp-specific)
- General UI chrome and controls
- Marketing materials
- Landing pages
- Brand assets and logos

### When to Use WhatsApp Colors

✅ **Only use WhatsApp colors for:**

- WhatsApp chat message bubbles (to maintain familiarity)
- "Connected to WhatsApp" status indicators
- WhatsApp data source badges
- WhatsApp export/import buttons
- WhatsApp Web integration features
- Platform selection toggles (when WhatsApp is selected)

❌ **Do NOT use WhatsApp colors for:**

- Generic conversation analysis features
- Multi-platform features (Telegram, Discord, etc.)
- General navigation or UI
- Primary branding elements

## Color Combinations

### Recommended Pairings

1. **Primary CTA**: Deep Purple background + White text
2. **Secondary CTA**: Bright Cyan background + White text
3. **Tertiary/Ghost**: Soft Lavender background + Deep Purple text
4. **Hover States**: Deep Purple → Bright Cyan
5. **Links**: Deep Purple (default) → Bright Cyan (hover)

### Gradient Patterns

```css
/* ConvoLens Primary Gradient */
background: linear-gradient(135deg, #6b46c1 0%, #06b6d4 100%);

/* ConvoLens Accent Gradient */
background: linear-gradient(135deg, #c4b5fd 0%, #06b6d4 100%);

/* ConvoLens Full Gradient */
background: linear-gradient(135deg, #6b46c1 0%, #c4b5fd 50%, #06b6d4 100%);
```

### WhatsApp-Specific Gradients (Only for WhatsApp features)

```css
/* WhatsApp Integration Indicator */
background: linear-gradient(90deg, #25d366, #128c7e);
```

## Accessibility

### Contrast Ratios

All color combinations meet WCAG 2.1 Level AA standards:

- Deep Purple (#6B46C1) on White: 4.88:1 ✅
- Bright Cyan (#06B6D4) on White: 3.02:1 (use for non-text elements)
- Deep Purple (#6B46C1) on Soft Lavender (#C4B5FD): 3.12:1 (use for large text)

### Dark Mode

In dark mode, adjust colors for better visibility:

- Deep Purple: Lighten to `#8B66E1` for better contrast
- Bright Cyan: Keep at `#06B6D4` (already vibrant)
- Soft Lavender: Darken to `#A495DD` for dark backgrounds

## CSS Variables

### Global CSS Variables (globals.css)

```css
:root {
  /* ConvoLens Brand Colors */
  --convolens-primary: #6b46c1;
  --convolens-secondary: #06b6d4;
  --convolens-accent: #c4b5fd;

  /* WhatsApp Colors (for WhatsApp-specific features only) */
  --whatsapp-primary: #25d366;
  --whatsapp-primary-dark: #128c7e;
  --whatsapp-secondary: #dcf8c6;
}
```

### Tailwind Custom Colors (tailwind.config.ts)

```typescript
colors: {
  convolens: {
    primary: '#6B46C1',
    secondary: '#06B6D4',
    accent: '#C4B5FD',
  },
  whatsapp: {
    primary: '#25D366',
    dark: '#128C7E',
    light: '#DCF8C6',
  },
}
```

## Implementation Examples

### Button Styling

```tsx
// Primary ConvoLens Button
<button className="bg-[#6B46C1] hover:bg-[#06B6D4] text-white">
  Analyze Conversation
</button>

// WhatsApp-Specific Button (only when relevant)
<button className="bg-[#25D366] hover:bg-[#128C7E] text-white">
  Connect WhatsApp
</button>
```

### Platform Indicators

```tsx
// Multi-platform selector
<div className="platform-selector">
  {/* ConvoLens colors for general state */}
  <button className="border-2 border-[#6B46C1] selected">All Platforms</button>

  {/* WhatsApp green only when WhatsApp is selected/active */}
  <button className="border-2 border-[#25D366] selected">
    <WhatsAppIcon /> WhatsApp
  </button>

  {/* ConvoLens colors for other platforms */}
  <button className="border-2 border-[#6B46C1]">
    <TelegramIcon /> Telegram
  </button>
</div>
```

### Data Visualization

```tsx
// Use ConvoLens colors for charts, unless specifically showing WhatsApp data
const chartColors = {
  primary: "#6B46C1",
  secondary: "#06B6D4",
  accent: "#C4B5FD",
  // Only use whatsappGreen when showing WhatsApp-specific data series
  whatsappData: "#25D366",
};
```

## Brand Assets

### Logo Usage

- **Primary Logo**: Use Deep Purple (#6B46C1) for the primary logo
- **Light Backgrounds**: Deep Purple logo + Bright Cyan accent
- **Dark Backgrounds**: White logo with Bright Cyan accent
- **WhatsApp Integration Badge**: Small WhatsApp green indicator can be added to show WhatsApp compatibility

### Marketing Materials

- **Primary**: Deep Purple and Bright Cyan
- **Accent**: Soft Lavender for subtle elements
- **WhatsApp Reference**: Only show WhatsApp green in "Supported Platforms" sections

## Migration Notes

When updating existing components:

1. Replace primary green (#25D366) with Deep Purple (#6B46C1)
2. Replace dark green (#128C7E) with Bright Cyan (#06B6D4)
3. **Preserve** WhatsApp green only for:
   - Chat message bubbles displaying WhatsApp messages
   - WhatsApp connection/status indicators
   - WhatsApp-specific feature labels

## Questions?

If unsure whether to use ConvoLens or WhatsApp colors, ask:

- "Is this feature/element specific to WhatsApp?"
  - **Yes** → Use WhatsApp green
  - **No** → Use ConvoLens colors
- "Will this feature work with other platforms (Telegram, Discord)?"
  - **Yes** → Use ConvoLens colors

---

**Last Updated**: December 2025  
**Version**: 1.0  
**Status**: Active Brand Guidelines
