"use client";

import { useEffect, useState } from "react";

import { CommandPalette } from "@/components/ui/CommandPalette";
import { ShortcutHelp } from "@/components/ui/ShortcutHelp";
import { useCmdK } from "@/hooks/useCmdK";

/**
 * Mount once at app root.
 * - ⌘K / Ctrl+K  → opens CommandPalette
 * - ?             → opens ShortcutHelp (when palette is closed & focus not in an input)
 * - Esc           → closes whichever is open
 */
export function CommandPaletteRoot() {
  const { isOpen, close } = useCmdK();
  const [helpOpen, setHelpOpen] = useState(false);

  // Register ? shortcut (skip when typing in inputs/textareas)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isEditable =
        tag === "input" || tag === "textarea" || (e.target as HTMLElement)?.isContentEditable;

      if (e.key === "?" && !isEditable && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (isOpen) {
          // If palette is open, close it and let ShortcutHelp show
          close();
        }
        setHelpOpen((prev) => !prev);
      }

      // Esc closes help if palette is not open
      if (e.key === "Escape" && helpOpen && !isOpen) {
        setHelpOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, helpOpen, close]);

  return (
    <>
      <CommandPalette isOpen={isOpen} onClose={close} />
      {/* Standalone help (shown when palette is closed) */}
      {!isOpen && <ShortcutHelp isOpen={helpOpen} onClose={() => setHelpOpen(false)} />}
    </>
  );
}
