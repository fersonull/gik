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
  light-graph-0: '#2863c7'
  light-graph-1: '#23815a'
  light-graph-2: '#9b6410'
  light-graph-3: '#9850b3'
  light-graph-4: '#b6426b'
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
  dark-graph-0: '#8bb4ff'
  dark-graph-1: '#85d1ac'
  dark-graph-2: '#e4bf76'
  dark-graph-3: '#c8a0e8'
  dark-graph-4: '#f09ebc'
  window-close-hover: '#c42b3c'
  dialog-backdrop: '#11131865'
typography:
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter Variable', 'Segoe UI', sans-serif"
    fontSize: '13px'
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter Variable', 'Segoe UI', sans-serif"
    fontSize: '16px'
    fontWeight: 600
    letterSpacing: '-0.02em'
  heading:
    fontSize: '14px'
    fontWeight: 600
  dialog-title:
    fontSize: '17px'
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: '-0.025em'
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
  dialog: '16px'
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
  dialog:
    backgroundColor: '{colors.light-surface}'
    textColor: '{colors.light-ink}'
    rounded: '{rounded.dialog}'
    width: 'min(520px, calc(100vw - 48px))'
  dialog-dark:
    backgroundColor: '{colors.dark-surface}'
    textColor: '{colors.dark-ink}'
    rounded: '{rounded.dialog}'
    width: 'min(520px, calc(100vw - 48px))'
  dialog-field:
    backgroundColor: '{colors.light-subtle}'
    textColor: '{colors.light-ink}'
    rounded: '{rounded.menu}'
    padding: '10px 12px'
  workspace:
    backgroundColor: '{colors.light-surface}'
    rounded: '{rounded.sheet}'
  workspace-dark:
    backgroundColor: '{colors.dark-surface}'
    rounded: '{rounded.sheet}'
---

# Design System: Gik

## Overview

Gik uses Mac-inspired craft with native Windows behavior: compact neutral panels, restrained corners, clear type, and precise alignment. The toolbar integrates themed Windows-style caption controls, dragging, and native window actions; F11 hides this chrome in fullscreen. Controls, shortcuts, focus, and resizing should feel at home on Windows.

The workbench keeps repository state readable through repeated lists, dividers, selected rows, and a continuous content sheet. Light and dark themes share the same hierarchy and follow the OS by default. The visual system supports sustained work rather than decorative presentation.

**Key Characteristics:**

- Neutral frame around a bordered content sheet.
- Compact UI with readable secondary metadata.
- Blue for selection, focus, and primary action; semantic color for Git state.
- Immediate keyboard actions and expressive, purposeful motion on occasional surfaces.

## Colors

The palette is neutral with a functional blue accent. Frontmatter records the actual light and dark CSS values; paired names map to the same semantic custom property in each theme.

### Primary

The accent marks primary actions, active repository tabs, references, and selected diff lines. The selected tone fills active files, comparison labels, and informational banners. Accent ink provides the corresponding button text. Focus has its own visible outline token.

### Neutral

Frame is the outer shell; surface is the content sheet, inputs, and overlays. Subtle separates toolbars and quiet sections; hover identifies interactive rows. Ink is the main text, muted supports metadata, and line separates adjacent regions. Dark mode changes these values without changing their roles.

### Semantic state

Positive and negative distinguish additions and removals, supported by signs, labels, or icons. Add and remove backgrounds tint diff rows. Warning identifies caution. Color alone must not carry an operation's meaning.

History has a separate five-color light/dark graph palette for branch continuity, independent of addition/removal semantics. First-parent paths retain their assigned color while other parent paths receive a color from the same repeating palette. Colors may repeat and do not uniquely identify branch names. The close-window hover color is reserved for the caption close action.

## Typography

Use locally bundled Inter Variable on Windows, with Apple system faces on macOS and Segoe UI as a fallback. The Inter Open Font License ships with the source and installer. Cascadia Code and Consolas are for code, terminal output, hashes, and line numbers; the code stack also includes an SFMono-Regular fallback. Do not use monospace as a general interface style.

Body text and common labels use the compact body scale. Secondary metadata is smaller; headings establish hierarchy through modest size changes and semibold weight. Collection headings and the welcome screen have local larger styles; they do not establish a general display type system. Keep title case and sentence case as implemented, with tabular numerals where counts and line numbers align.

## Layout

Use a 4px spacing basis, retaining the observed 6px and 10px optical/control adjustments. The default sidebar is 208px and is resizable; collapse reduces it to 56px. The shell has a 52px toolbar, flexible work area, and 28px status bar. The integrated toolbar carries the drag regions and three 44px Windows caption controls; F11 fullscreen hides the entire toolbar and releases that height. The inset sheet clips its internal content, while lists and diffs own their scrolling. Repository tabs occupy 40px.

Changes start with a 320px file pane beside a flexible diff; the commit form anchors below the list. History starts with a 560px list beside its detail pane. Both list widths persist independently and resize through a draggable separator or the Left/Right arrow keys in 8px steps. Widths clamp to a 240px minimum and reserve 280px for details when available; resizing the window reclamps them. Terminal and operation log share a bottom drawer, initially 240px and resizable. Preserve these working relationships when adding screens; do not replace dense repository lists with decorative cards.

At widths up to 1150px, surrounding spacing tightens, toolbar action labels hide, and the branch picker narrows while list widths remain governed by their persisted size and available space. At widths up to 850px, the sidebar becomes an icon rail and history stacks its list and detail, hiding its vertical resize separator; the history list gets 45% of the available height with a 200px minimum. Changes retain their resizable split. At heights up to 760px, secondary sidebar prose disappears and grouping tightens. The CSS body minimum width is 600px, while the native window enforces a 1024px by 640px minimum: compact browser captures exercise layouts below that native minimum.

## Elevation & Depth

Persistent surfaces are flat. Neutral fills, single-pixel borders, and the framed content sheet establish depth. Shadows belong to transient overlays: the menu uses the low overlay shadow and the dialog uses the larger modal shadow recorded in the sidecar. Dialogs dim the underlying application with a backdrop. Avoid adding shadows to every panel or row.

## Shapes

Controls use the shared control radius; the content sheet uses the sheet radius, and dialogs use the larger dialog radius. Menus and dialog form fields share the intermediate menu radius. Rows, badges, and segmented choices use smaller corners; diff rows remain square and full-width. Circular dots indicate discrete state. Use borders to separate regions rather than rounding each nested section into a card.

## Components

### Buttons

Compact and direct: a minimum 28px height, a thin border, and the shared control radius. Primary actions use accent and accent ink with semibold text. Toolbar and icon actions use transparent surfaces until interaction. Hover changes the fill, active uses the line tone, and disabled controls reduce opacity. Primary hover darkens slightly. Keyboard focus is a 2px focus outline with a 2px offset.

### Inputs / Fields

Workbench fields use surface, line borders, and the shared control radius. Dialog form fields use the subtle fill, menu radius, and larger inset; single-line inputs and selects have a minimum 42px height. Placeholder text uses muted ink. Filter fields expose focus on their surrounding container so the whole search control is visible. Textareas resize vertically. Keep labels and errors explicit; preserve native input behavior.

### Navigation

Sidebar items combine icons, labels, and optional counts. Active items use hover fill and semibold text. The collapsed rail retains accessible names. Repository tabs mark the active repository with an accent underline; drawer tabs use the same underline relationship. Compact layouts hide lower-priority text before shrinking the core work area.

### Lists and diffs

File rows use a selected fill and readable name/path hierarchy. Diffs use code typography, a 24px line rhythm, muted line numbers, semantic row tints, and addition/removal signs. Selection adds an accent outline. Long content scrolls in the diff surface. History uses aligned commit metadata and a graph alongside a bounded, scrollable list, with detail in the adjacent pane. Graph colors identify branch continuity using five paired light/dark tokens; connected paths and merge nodes reinforce the structure. Graph lanes follow commit parents, including merge edges; merge commits have a larger node. The list/detail separator has a 6px drag target, a visible hover fill, and keyboard focus.

### Overlays

Menus use a bordered surface and low overlay shadow. The branch picker opens a 320px popover below the branch control with a search field, scrollable options, current-state indicator, and a management action. Its origin follows the trigger at the top left.

Dialogs use the dialog radius and modal shadow, a title area without a bottom divider, a scrollable body, and a subtle footer. Standard dialogs cap at 520px wide; wide inspection dialogs retain their 960px cap. The native dialog backdrop dims the workbench. Form labels and fields get more vertical space than toolbar controls, and footer actions have a 32px minimum height. The command palette presents a search field and selectable command list with keyboard hints and opens immediately.

### Motion and assets

Motion is enabled by default and can be switched off persistently in Settings. Dialogs enter in 220ms and dismiss in 140ms; menus and drawers combine opacity with small translations and scale changes. File group disclosures animate their height and chevron. Pointer presses compress eligible buttons slightly, and pointer-triggered view changes enter with a brief spatial transition. The shared strong ease-out curve keeps these 120–220ms effects brisk. Keyboard-triggered dialogs, menus, drawers, disclosures, and navigation stay immediate; the command palette, virtualized rows, diffs, and Git graph data do not receive entrance motion. Reduced-motion preferences and the performance switch disable motion, including the loading spinner.

Use the existing vector icon vocabulary for commands and repository states. There are no raster illustrations in the interface; generated application icon provenance belongs with the icon assets rather than in the design token system.

## Do's and Don'ts

### Do:

- **Do** keep the integrated caption controls themeable while preserving native Windows window actions, shortcuts, focus, and resizing behavior.
- **Do** use paired semantic tokens so both themes retain the same information hierarchy.
- **Do** retain keyboard access, visible focus, forced-color support, reduced motion, and non-color state indicators.
- **Do** keep repeated Git operations immediate and repository content readable.

### Don't:

- **Don't** use code fonts for ordinary interface text.
- **Don't** introduce decorative color, panel shadows, raster illustrations, or oversized display typography into the workbench.
- **Don't** animate keyboard selection or navigation.
- **Don't** turn the integrated Windows caption controls into imitation macOS traffic lights.
