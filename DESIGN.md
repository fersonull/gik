---
name: Gik
description: A compact Git workbench with Mac-inspired craft and native Windows behavior.
colors:
  light-frame: '#f5f5f7'
  light-surface: '#fff'
  light-subtle: '#fafafb'
  light-hover: '#ebebee'
  light-selected: '#e9effb'
  light-ink: '#1d1d1f'
  light-muted: '#64646d'
  light-line: '#e2e2e7'
  light-accent: '#255fc7'
  light-accent-ink: '#fff'
  light-positive: '#237044'
  light-negative: '#b52c39'
  light-warning: '#855600'
  light-add-bg: '#edf7ee'
  light-remove-bg: '#fceff0'
  light-focus: '#3275d6'
  dark-frame: '#202022'
  dark-surface: '#29292c'
  dark-subtle: '#252528'
  dark-hover: '#343438'
  dark-selected: '#2e3b56'
  dark-ink: '#f5f5f7'
  dark-muted: '#aaaab4'
  dark-line: '#3c3c42'
  dark-accent: '#8bb4ff'
  dark-accent-ink: '#162440'
  dark-positive: '#91d0a4'
  dark-negative: '#ff9ca8'
  dark-warning: '#e5c079'
  dark-add-bg: '#263b30'
  dark-remove-bg: '#442b32'
  dark-focus: '#8bb4ff'
typography:
  body:
    fontFamily: "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: '13px'
  title:
    fontFamily: "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: '16px'
    fontWeight: 600
    letterSpacing: '-0.02em'
  heading:
    fontSize: '14px'
    fontWeight: 600
  label:
    fontSize: '13px'
    fontWeight: 600
  metadata:
    fontSize: '11px'
  code:
    fontFamily: "'Cascadia Code', Consolas, 'SFMono-Regular', monospace"
    fontSize: '13px'
  output:
    fontFamily: "'Cascadia Code', Consolas, 'SFMono-Regular', monospace"
    fontSize: '13px'
    lineHeight: 1.65
rounded:
  square: '0'
  segment: '3px'
  badge: '4px'
  row: '5px'
  control: '6px'
  menu: '8px'
  sheet: '12px'
spacing:
  compact: '4px'
  control-gap: '6px'
  small: '8px'
  control-inline: '10px'
  medium: '12px'
  regular: '16px'
  large: '20px'
  section: '24px'
  spacious: '28px'
  empty: '40px'
components:
  button:
    backgroundColor: '{colors.light-surface}'
    textColor: '{colors.light-ink}'
    rounded: '{rounded.control}'
    padding: '4px 10px'
  button-primary:
    backgroundColor: '{colors.light-accent}'
    textColor: '{colors.light-accent-ink}'
    rounded: '{rounded.control}'
    padding: '4px 10px'
  button-primary-dark:
    backgroundColor: '{colors.dark-accent}'
    textColor: '{colors.dark-accent-ink}'
    rounded: '{rounded.control}'
    padding: '4px 10px'
  field:
    backgroundColor: '{colors.light-surface}'
    textColor: '{colors.light-ink}'
    rounded: '{rounded.control}'
    padding: '8px'
  workspace:
    backgroundColor: '{colors.light-surface}'
    rounded: '{rounded.sheet}'
  workspace-dark:
    backgroundColor: '{colors.dark-surface}'
    rounded: '{rounded.sheet}'
---

# Design System: Gik

## Overview

Gik uses Mac-inspired craft with native Windows behavior: compact neutral panels, restrained corners, clear type, and precise alignment. The native titlebar belongs to the operating system. Controls, shortcuts, focus, and resizing should feel at home on Windows.

The workbench keeps repository state readable through repeated lists, dividers, selected rows, and a continuous content sheet. Light and dark themes share the same hierarchy and follow the OS by default. The visual system supports sustained work rather than decorative presentation.

**Key Characteristics:**

- Neutral frame around a bordered content sheet.
- Compact UI with readable secondary metadata.
- Blue for selection, focus, and primary action; semantic color for Git state.
- Immediate keyboard actions and restrained motion.

## Colors

The palette is neutral with a functional blue accent. Frontmatter records the actual light and dark CSS values; paired names map to the same semantic custom property in each theme.

### Primary

The accent marks primary actions, active repository tabs, references, and selected diff lines. The selected tone fills active files, comparison labels, and informational banners. Accent ink provides the corresponding button text. Focus has its own visible outline token.

### Neutral

Frame is the outer shell; surface is the content sheet, inputs, and overlays. Subtle separates toolbars and quiet sections; hover identifies interactive rows. Ink is the main text, muted supports metadata, and line separates adjacent regions. Dark mode changes these values without changing their roles.

### Semantic state

Positive and negative distinguish additions and removals, supported by signs, labels, or icons. Add and remove backgrounds tint diff rows. Warning identifies caution. Color alone must not carry an operation's meaning.

## Typography

Use Segoe UI Variable with Segoe UI and system fallbacks for interface text. Cascadia Code and Consolas are for code, terminal output, hashes, and line numbers; the code stack also includes an SFMono-Regular fallback. Do not use monospace as a general interface style.

Body text and common labels use the compact body scale. Secondary metadata is smaller; headings establish hierarchy through modest size changes and semibold weight. Collection headings and the welcome screen have local larger styles; they do not establish a general display type system. Keep title case and sentence case as implemented, with tabular numerals where counts and line numbers align.

## Layout

Use a 4px spacing basis, retaining the observed 6px and 10px optical/control adjustments. The default sidebar is 208px and is resizable; collapse reduces it to 56px. The shell has a 52px toolbar, flexible work area, and 28px status bar. The inset sheet clips its internal content, while lists and diffs own their scrolling. Repository tabs occupy 40px.

Changes start with a 320px file pane beside a flexible diff; the commit form anchors below the list. History starts with a 560px list beside its detail pane. Both list widths persist independently and resize through a draggable separator or the Left/Right arrow keys in 8px steps. Widths clamp to a 240px minimum and reserve 280px for details when available; resizing the window reclamps them. Terminal and operation log share a bottom drawer, initially 240px and resizable. Preserve these working relationships when adding screens; do not replace dense repository lists with decorative cards.

At widths up to 1150px, surrounding spacing tightens while list widths remain governed by their persisted size and available space. At widths up to 850px, the sidebar becomes an icon rail and history stacks its list and detail, hiding its vertical resize separator. Changes retain their resizable split. At heights up to 760px, secondary sidebar prose disappears and grouping tightens. The current body minimum width is 600px: this is a desktop workbench, with compact-window adaptation rather than a phone layout.

## Elevation & Depth

Persistent surfaces are flat. Neutral fills, single-pixel borders, and the framed content sheet establish depth. Shadows belong to transient overlays: the menu uses the low overlay shadow and the dialog uses the larger modal shadow recorded in the sidecar. Dialogs dim the underlying application with a backdrop. Avoid adding shadows to every panel or row.

## Shapes

Controls use the shared control radius; the content sheet and dialogs use the larger sheet radius. Menus sit between them. Rows, badges, and segmented choices use smaller corners; diff rows remain square and full-width. Circular dots indicate discrete state. Use borders to separate regions rather than rounding each nested section into a card.

## Components

### Buttons

Compact and direct: a minimum 28px height, a thin border, and the shared control radius. Primary actions use accent and accent ink with semibold text. Toolbar and icon actions use transparent surfaces until interaction. Hover changes the fill, active uses the line tone, and disabled controls reduce opacity. Primary hover darkens slightly. Keyboard focus is a 2px focus outline with a 2px offset.

### Inputs / Fields

Fields use surface, line borders, and the shared control radius. Placeholder text uses muted ink. Filter fields expose focus on their surrounding container so the whole search control is visible. Textareas resize vertically. Keep labels and errors explicit; preserve native input behavior.

### Navigation

Sidebar items combine icons, labels, and optional counts. Active items use hover fill and semibold text. The collapsed rail retains accessible names. Repository tabs mark the active repository with an accent underline; drawer tabs use the same underline relationship. Compact layouts hide lower-priority text before shrinking the core work area.

### Lists and diffs

File rows use a selected fill and readable name/path hierarchy. Diffs use code typography, a 24px line rhythm, muted line numbers, semantic row tints, and addition/removal signs. Selection adds an accent outline. Long content scrolls in the diff surface. History uses aligned commit metadata and a graph alongside the list, with detail in the adjacent pane. Graph lanes follow commit parents, including merge edges; merge commits have a larger node. The list/detail separator has a 6px drag target, a visible hover fill, and keyboard focus.

### Overlays

Menus use a bordered surface and low overlay shadow. Dialogs use the larger radius and modal shadow, separate header/body/footer regions, a scrollable body, and the native dialog backdrop. The command palette presents a search field and selectable command list with keyboard hints.

### Motion and assets

Navigation, selection, keyboard actions, and panels change immediately. The loading spinner is a linear one-second rotation; reduced motion disables animation and transitions. The CSS easing variable exists but is not currently assigned to an active transition. Keep state feedback immediate.

Use the existing vector icon vocabulary for commands and repository states. There are no raster illustrations in the interface; generated application icon provenance belongs with the icon assets rather than in the design token system.

## Do's and Don'ts

### Do:

- **Do** preserve native Windows titlebar, shortcuts, focus, and resizing behavior.
- **Do** use paired semantic tokens so both themes retain the same information hierarchy.
- **Do** retain keyboard access, visible focus, forced-color support, reduced motion, and non-color state indicators.
- **Do** keep repeated Git operations immediate and repository content readable.

### Don't:

- **Don't** use code fonts for ordinary interface text.
- **Don't** introduce decorative color, panel shadows, raster illustrations, or oversized display typography into the workbench.
- **Don't** animate keyboard selection or navigation.
- **Don't** replace native window chrome with imitation macOS window controls.
