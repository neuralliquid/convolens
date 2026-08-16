// Re-exported from @convolens/ui — see packages/ui/src/components/dropdown-menu.tsx.
// This file used to hold an independent local copy that had drifted:
// DropdownMenuContent/Item/Separator used hardcoded gray Tailwind classes
// instead of the semantic tokens (bg-popover, bg-accent, bg-muted) the
// package version uses. Re-exporting the package fixes that drift.
// See baton task 8ec9b31f.
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from "@convolens/ui"
