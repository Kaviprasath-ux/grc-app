# Styling

## Table of Contents
1. [What is CSS?](#what-is-css)
2. [What is Tailwind CSS?](#what-is-tailwind-css)
3. [How Tailwind Classes Work](#how-tailwind-classes-work)
4. [Why Tailwind Instead of Traditional CSS](#why-tailwind)
5. [shadcn/ui Component Styling](#shadcnui-component-styling)
6. [RTL Support for Arabic](#rtl-support)
7. [Responsive Design Breakpoints](#responsive-design-breakpoints)
8. [Dark Mode Support](#dark-mode-support)
9. [Custom Color Palette](#custom-color-palette)
10. [How to Modify Styles](#how-to-modify-styles)
11. [Adding New Tailwind Classes](#adding-new-tailwind-classes)
12. [CSS Variables Location](#css-variables-location)

---

## What is CSS?

**CSS (Cascading Style Sheets)** is the language that controls how HTML elements look. Without CSS, web pages are plain text on a white background — the browser's default rendering.

CSS rules look like this:
```css
/* selector { property: value; } */
.button {
  background-color: #3b82f6;  /* blue */
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
}
```

You write a selector (`.button` targets elements with class "button"), then declare properties and their values. The browser applies these styles when rendering the page.

### The Traditional Problem

In a large application, traditional CSS has significant drawbacks:
- **Global scope**: A `.button` style defined anywhere affects every `.button` in the entire application
- **Dead code**: Unused styles accumulate and are hard to identify
- **Naming conflicts**: Two developers independently naming a class `.card` causes one to override the other
- **Context switching**: Editing both HTML/JSX and a separate `.css` file to style one element

---

## What is Tailwind CSS?

**Tailwind CSS** is a utility-first CSS framework. Instead of writing custom CSS classes, you apply small, single-purpose **utility classes** directly in your HTML/JSX.

### Utility-First Explained

Traditional approach:
```html
<!-- HTML -->
<button class="primary-button">Save</button>
```
```css
/* Separate CSS file */
.primary-button {
  background-color: #3b82f6;
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
}
```

Tailwind approach:
```html
<!-- Everything in one place -->
<button class="bg-blue-500 text-white px-4 py-2 rounded-md">Save</button>
```

Each Tailwind class applies exactly one CSS property:
- `bg-blue-500` → `background-color: rgb(59, 130, 246)`
- `text-white` → `color: rgb(255, 255, 255)`
- `px-4` → `padding-left: 1rem; padding-right: 1rem`
- `py-2` → `padding-top: 0.5rem; padding-bottom: 0.5rem`
- `rounded-md` → `border-radius: 0.375rem`

---

## How Tailwind Classes Work

Tailwind classes follow a consistent naming convention:

### Spacing (`p`, `m`)

```
p-4    → padding: 1rem (all sides)
px-4   → padding-left + padding-right: 1rem
py-2   → padding-top + padding-bottom: 0.5rem
pt-3   → padding-top: 0.75rem

m-4    → margin: 1rem
mx-auto → margin-left + margin-right: auto (centers block elements)
mt-6   → margin-top: 1.5rem
```

The number scale: `1 = 0.25rem, 2 = 0.5rem, 4 = 1rem, 6 = 1.5rem, 8 = 2rem`

### Colors

```
bg-blue-500    → background-color: blue (500 shade)
text-gray-700  → color: dark gray
border-red-300 → border-color: light red

Color scale: 50 (lightest) → 100 → 200 → 300 → 400 → 500 (mid) → 600 → 700 → 800 → 900 (darkest)
```

### Typography

```
text-sm     → font-size: 0.875rem
text-base   → font-size: 1rem
text-lg     → font-size: 1.125rem
text-xl     → font-size: 1.25rem
text-2xl    → font-size: 1.5rem

font-medium → font-weight: 500
font-semibold → font-weight: 600
font-bold   → font-weight: 700
```

### Layout

```
flex         → display: flex
flex-col     → flex-direction: column
items-center → align-items: center
justify-between → justify-content: space-between
gap-4        → gap: 1rem

grid         → display: grid
grid-cols-3  → grid-template-columns: repeat(3, minmax(0, 1fr))

hidden       → display: none
block        → display: block
```

### Sizing

```
w-full  → width: 100%
w-64    → width: 16rem
h-10    → height: 2.5rem
min-h-screen → min-height: 100vh
```

### Pseudo-States

Prefix a class with a state variant followed by `:`:
```
hover:bg-blue-600   → on mouse hover: background becomes darker blue
focus:ring-2        → on focus: show a focus ring
active:scale-95     → while clicked: slightly shrink

disabled:opacity-50 → when disabled: 50% opacity
```

### Combining Classes in JSX

```tsx
<div className="flex items-center gap-4 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
  <AlertTriangle className="h-5 w-5 text-red-500" />
  <span className="text-sm font-medium text-gray-900">High Risk</span>
</div>
```

### Conditional Classes with `cn()`

The `cn()` utility (from `src/lib/utils.ts`, built on `clsx` + `tailwind-merge`) safely combines conditional classes:

```tsx
import { cn } from "@/lib/utils";

<div className={cn(
  "px-4 py-2 rounded-md text-sm font-medium", // Base classes (always applied)
  isActive && "bg-blue-500 text-white",         // Active state
  isDisabled && "opacity-50 cursor-not-allowed", // Disabled state
  className,                                    // External override
)}>
```

Without `cn()`, conflicting classes would both apply. `tailwind-merge` (inside `cn`) ensures later classes override earlier ones: `cn("p-4 p-2")` → only `p-2` applies.

---

## Why Tailwind Instead of Traditional CSS

The GRC application uses Tailwind for these reasons:

### 1. No naming collisions

Every component is styled with its own inline class strings. There is no global `.button` class that two components fight over.

### 2. Styles live with the component

A developer reading a component's JSX sees both the structure and the styling in one place — no context-switching between `.tsx` and `.css` files.

### 3. Automatic dead code elimination

Tailwind's build step scans every file for class names and only includes CSS for classes that are actually used. A production build has only the CSS needed — typically a few kilobytes.

### 4. Responsive and state variants are built in

Instead of writing media queries in CSS files, you prefix classes:
```
sm:text-sm md:text-base lg:text-lg
hover:bg-gray-100 focus:ring-blue-500
```

### 5. Consistent design tokens

Spacing values (4, 8, 12 multiples of 0.25rem), font sizes, colors, and border-radius values are all standardised in `tailwind.config.ts`. Every developer uses the same scale.

---

## shadcn/ui Component Styling

shadcn/ui components are styled with Tailwind utility classes, but their **colour palette comes from CSS custom properties** (CSS variables). This is what enables the theming system.

### CSS Variable Pattern

```css
/* Component uses semantic variable names */
.button {
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}
```

```css
/* The variables are defined in globals.css */
:root {
  --primary: 221.2 83.2% 53.3%;           /* HSL values */
  --primary-foreground: 210 40% 98%;
}
```

```css
/* Dark mode just redefines the same variables */
.dark {
  --primary: 217.2 91.2% 59.8%;          /* Different shade */
  --primary-foreground: 222.2 47.4% 11.2%;
}
```

This way, every component automatically adjusts its colors when the theme changes — without any JavaScript.

### Tailwind Maps the Variables

In `tailwind.config.ts`, colors are mapped to the CSS variables:

```ts
colors: {
  primary: {
    DEFAULT: "hsl(var(--primary))",
    foreground: "hsl(var(--primary-foreground))",
  },
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
  // ...
}
```

This lets you use `bg-primary` in JSX and have it automatically theme-aware.

---

## RTL Support for Arabic

When the language is Arabic (`locale === "ar"`), all text reads right-to-left and the page layout must mirror. Tailwind supports RTL with directional variants.

### Setting the Direction

The `LanguageProvider` updates the HTML `dir` attribute:

```tsx
// When Arabic is selected:
document.documentElement.dir = "rtl";  // Makes entire page RTL
document.documentElement.lang = "ar";
```

### Directional Tailwind Variants

Instead of writing separate CSS for LTR and RTL, use the `ltr:` and `rtl:` prefixes:

```tsx
// Margin - left in LTR, right in RTL
<div className="ltr:ml-4 rtl:mr-4">

// Text alignment
<p className="ltr:text-left rtl:text-right">

// Padding for sidebar offset
<div className={cn(
  "ltr:xl:pl-[260px] rtl:xl:pr-[260px]"  // Push content right of sidebar (LTR) or left (RTL)
)}>

// Icon mirroring - flip arrow icons for RTL reading direction
<ChevronRight className="ltr:rotate-0 rtl:rotate-180" />
```

### Mobile Sidebar Direction

The Sheet (sidebar overlay) slides from the left in LTR and from the right in RTL:

```tsx
<Sheet>
  <SheetContent side={isRTL ? "right" : "left"}>
    <Sidebar />
  </SheetContent>
</Sheet>
```

### Testing RTL

1. Click the language switcher in the header
2. Select Arabic (AR)
3. The page layout should immediately mirror:
   - Sidebar moves to the right
   - Text becomes right-aligned
   - Icons (chevrons, arrows) flip direction
   - Form labels align to the right

---

## Responsive Design Breakpoints

Tailwind uses **mobile-first** responsive design. Classes apply to all screen sizes by default, and breakpoint prefixes apply at and above the specified width:

| Prefix | Minimum width | Typical target |
|--------|--------------|----------------|
| (none) | 0px | All screens |
| `sm:` | 640px | Large phones |
| `md:` | 768px | Tablets |
| `lg:` | 1024px | Laptops |
| `xl:` | 1280px | Desktop |
| `2xl:` | 1536px | Large desktop |

### Common Responsive Patterns in the App

#### Sidebar visibility

```tsx
{/* Desktop sidebar: always visible at xl+ */}
<div className="hidden xl:block">
  <Sidebar />
</div>

{/* Mobile sidebar: Sheet overlay below xl */}
<Sheet>
  <SheetContent>
    <Sidebar />
  </SheetContent>
</Sheet>
```

#### Responsive grid

```tsx
{/* 1 column on mobile, 2 on tablet, 3 on desktop */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {statsCards}
</div>
```

#### Page padding

```tsx
{/* Less padding on mobile, more on desktop */}
<main className="p-4 lg:p-6">
```

#### Table horizontal scroll on mobile

```tsx
<div className="overflow-x-auto">
  <table className="min-w-full">
    {/* Table content — scrolls horizontally on small screens */}
  </table>
</div>
```

---

## Dark Mode Support

Dark mode is managed by `ThemeProvider` (`src/contexts/ThemeContext.tsx`), which:
1. Reads the user's preference from `localStorage`
2. Adds or removes the `dark` class on the `<html>` element
3. Optionally respects the OS preference via `prefers-color-scheme`

### How Components Support Dark Mode

All shadcn/ui components automatically support dark mode because they use CSS variables (described above). When `ThemeProvider` adds the `.dark` class to `<html>`, the CSS variable values change, and all components re-render with dark colors.

For custom components, use `dark:` prefix:

```tsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  Dark mode content
</div>
```

### CSS Variable Dark Mode Definitions

```css
/* src/app/globals.css */

:root {
  /* Light mode */
  --background: 0 0% 100%;          /* white */
  --foreground: 222.2 84% 4.9%;     /* near-black */
  --card: 0 0% 100%;
  --primary: 221.2 83.2% 53.3%;     /* blue */
}

.dark {
  /* Dark mode */
  --background: 222.2 84% 4.9%;     /* dark navy */
  --foreground: 210 40% 98%;         /* near-white */
  --card: 222.2 84% 4.9%;
  --primary: 217.2 91.2% 59.8%;     /* brighter blue */
}
```

---

## Custom Color Palette

The GRC application extends Tailwind's default color palette with a custom `primary-` color family defined in `tailwind.config.ts`. These provide the consistent brand colors used throughout the application.

The custom palette is also exposed as CSS variables so shadcn/ui components can reference them:

```css
:root {
  --primary: 221.2 83.2% 53.3%;     /* Main brand blue */
  --primary-foreground: 210 40% 98%; /* Text on primary backgrounds */
  --secondary: 210 40% 96.1%;        /* Light grey */
  --secondary-foreground: 222.2 47.4% 11.2%;
  --accent: 210 40% 96.1%;
  --destructive: 0 84.2% 60.2%;     /* Red for dangerous actions */
  --muted: 210 40% 96.1%;           /* Muted backgrounds */
  --muted-foreground: 215.4 16.3% 46.9%;
  --border: 214.3 31.8% 91.4%;      /* Border colours */
  --ring: 221.2 83.2% 53.3%;        /* Focus ring colour */
}
```

Use these via Tailwind classes: `bg-primary`, `text-destructive`, `border-border`, `text-muted-foreground`.

---

## How to Modify Styles

### Modifying an Existing Component's Styles

Find the component file and update its Tailwind classes directly:

```tsx
// Before:
<div className="p-4 bg-white rounded-md">

// After:
<div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
```

### Modifying a shadcn/ui Component

Because shadcn/ui components are copied into your project (not installed as a dependency), you can modify them directly:

```tsx
// src/components/ui/button.tsx
// Change the primary variant's padding
const buttonVariants = cva("...", {
  variants: {
    size: {
      default: "h-10 px-4 py-2",   // Change from px-4 to px-6 if needed
      sm: "h-9 rounded-md px-3",
    },
  },
});
```

**Warning**: Changes to `src/components/ui/` components affect every usage of that component throughout the application. Test thoroughly after modifying these.

### Overriding Component Classes via `className` Prop

Most components accept a `className` prop for one-off overrides:

```tsx
// Standard Button
<Button>Default styling</Button>

// Button with extra margin for this specific use case
<Button className="mt-6 w-full">Full-width with top margin</Button>
```

The `cn()` utility inside Button merges the base classes with your override, with your override winning on conflicts.

---

## Adding New Tailwind Classes

Tailwind's class list covers almost all CSS properties. Before writing custom CSS, check if a Tailwind utility exists.

### Reference

The complete Tailwind CSS documentation at `https://tailwindcss.com/docs` is searchable. For example, searching "box shadow" shows all `shadow-*` classes.

### Arbitrary Values

For one-off values not in the standard scale, use square brackets:

```tsx
// Specific pixel value
<div className="w-[260px] h-[72px]">

// Specific color
<div className="bg-[#1a73e8]">

// Specific grid column template
<div className="grid-cols-[2fr,1fr,1fr]">
```

### Extending the Config

For values used in many places, add them to `tailwind.config.ts`:

```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      spacing: {
        "sidebar": "260px",   // Now usable as w-sidebar, pl-sidebar, etc.
      },
      colors: {
        "brand-blue": "#1a73e8",
      },
    },
  },
};
```

---

## CSS Variables Location

All CSS variables and base styles are defined in **`src/app/globals.css`**.

This file contains:

1. **Tailwind directives** — imports Tailwind's base, component, and utility layers:
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   ```

2. **Light mode variables** — all semantic color tokens for light theme (under `:root`)

3. **Dark mode variables** — all semantic color tokens for dark theme (under `.dark`)

4. **Base styles** — default body/html styles:
   ```css
   body {
     @apply bg-background text-foreground;
   }
   ```

5. **Custom utility classes** — any project-specific utilities not in Tailwind:
   ```css
   @layer utilities {
     .scrollbar-hide {
       scrollbar-width: none;
     }
   }
   ```

### When to Add to globals.css

Only add to `globals.css` when:
- Defining new CSS variables referenced by Tailwind config
- Overriding third-party component default styles
- Adding base element styles (not component classes)

For everything else, use Tailwind utility classes inline in JSX.
