"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search } from "lucide-react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  navigation,
  filterNavigationByPermissionsAndRole,
  type NavItem,
} from "@/lib/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

interface SearchItem {
  name: string;
  href: string;
  group: string;
  icon?: NavItem["icon"];
}

/**
 * Flatten navigation items into a flat list of searchable items.
 * Each item includes its parent group name for categorization.
 */
function flattenNavItems(items: NavItem[], parentGroup?: string): SearchItem[] {
  const result: SearchItem[] = [];

  for (const item of items) {
    // Skip "Log Out" from search
    if (item.alwaysVisible && item.name === "Log Out") continue;

    const group = parentGroup || item.name;

    if (item.children && item.children.length > 0) {
      result.push(...flattenNavItems(item.children, group));
    } else if (item.href) {
      result.push({
        name: item.name,
        href: item.href,
        group,
        icon: item.icon,
      });
    }
  }

  return result;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter navigation by user permissions and role
  const searchItems = useMemo(() => {
    if (!session?.user?.permissions || !session?.user?.roles) {
      return [];
    }

    const filtered = filterNavigationByPermissionsAndRole(
      navigation,
      session.user.permissions,
      session.user.roles
    );

    return flattenNavItems(filtered);
  }, [session?.user?.permissions, session?.user?.roles]);

  // Group items by their parent module
  const groupedItems = useMemo(() => {
    const groups: Record<string, SearchItem[]> = {};
    for (const item of searchItems) {
      if (!groups[item.group]) {
        groups[item.group] = [];
      }
      groups[item.group].push(item);
    }
    return groups;
  }, [searchItems]);

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Focus input when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="hidden md:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 h-9 w-64 lg:w-80 transition-colors"
        >
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="text-sm text-slate-400 flex-1 text-start">{t("Search")}...</span>
          <kbd className="pointer-events-none hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border border-slate-200 bg-white px-1.5 font-mono text-[10px] font-medium text-slate-400">
            <span className="text-xs">Ctrl</span>K
          </kbd>
        </button>
      </PopoverTrigger>

      {/* Mobile search button (icon only) */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden flex items-center justify-center h-9 w-9 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <Search className="h-5 w-5" />
      </button>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 rounded-lg shadow-lg border border-slate-200"
        align="start"
        sideOffset={4}
      >
        <Command className="rounded-lg">
          <CommandInput
            ref={inputRef}
            placeholder={t("Search pages") + "..."}
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>{t("No results found")}.</CommandEmpty>
            {Object.entries(groupedItems).map(([group, items]) => (
              <CommandGroup key={group} heading={t(group)}>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.href}
                      value={`${item.name} ${item.group}`}
                      onSelect={() => handleSelect(item.href)}
                      className="cursor-pointer"
                    >
                      {Icon && <Icon className="h-4 w-4 text-slate-500 me-2" />}
                      <span>{t(item.name)}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
