"use client";

import { useState } from "react";
import { GlassButton, GlassKbd, GlassLink } from "@/components/ui/glass";
import { useTranslation } from "react-i18next";

import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import { LanguageSwitch } from "@/components/language-switch";
import {
  GithubIcon,
  HeartFilledIcon,
  SearchIcon,
} from "@/components/icons";

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { t } = useTranslation();

  const searchInput = (
    <div className="glass-field flex h-9 w-56 items-center gap-2 rounded-xl px-3 transition-all duration-200 focus-within:ring-2 focus-within:ring-primary/40">
      <SearchIcon className="text-base text-muted pointer-events-none flex-shrink-0" />
      <input
        type="search"
        placeholder={t('common.search')}
        className="h-full w-full min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted/70 outline-none"
      />
      <GlassKbd className="hidden lg:inline-flex">
        <GlassKbd.Abbr keyValue="command" />
        <GlassKbd.Content>K</GlassKbd.Content>
      </GlassKbd>
    </div>
  );

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-separator glass-surface">
      <header className="mx-auto flex h-16 max-w-[1280px] items-center justify-end gap-4 px-6">
        <div className="flex items-center gap-2">
          <GlassLink
            aria-label="Github"
            href={siteConfig.links.github}
            rel="noopener noreferrer"
            target="_blank"
          >
            <GithubIcon className="text-muted" />
          </GlassLink>
          <ThemeSwitch />
          <LanguageSwitch />
          <div className="hidden lg:flex">{searchInput}</div>
          <div className="hidden md:flex">
            <GlassButton
              className="text-sm font-normal"
              variant="tertiary"
              onPress={() => window.open(siteConfig.links.sponsor, "_blank")}
            >
              <HeartFilledIcon className="text-danger" />
              {t('common.sponsor')}
            </GlassButton>
          </div>
        </div>

        <div className="flex sm:hidden items-center gap-2">
          <GlassLink
            aria-label="Github"
            href={siteConfig.links.github}
            rel="noopener noreferrer"
            target="_blank"
          >
            <GithubIcon className="text-muted" />
          </GlassLink>
          <ThemeSwitch />
          <LanguageSwitch />
          <button
            aria-expanded={isMenuOpen}
            aria-label="Toggle menu"
            className="p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMenuOpen ? (
                <path
                  d="M6 18L18 6M6 6l12 12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              ) : (
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              )}
            </svg>
          </button>
        </div>
      </header>

      {isMenuOpen && (
        <div className="border-t border-separator sm:hidden">
          <div className="p-4">{searchInput}</div>
        </div>
      )}
    </nav>
  );
};
