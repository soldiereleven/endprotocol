"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input } from "@heroui/react";
import { setConfig } from "@/utils/configService";

// SVG flag components
const USFlag = () => (
  <svg
    className="w-6 h-4 rounded-sm"
    viewBox="0 0 36 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="36" height="24" fill="#B22234" />
    <path
      d="M0 2h36M0 6h36M0 10h36M0 14h36M0 18h36M0 22h36"
      stroke="#fff"
      strokeWidth="2"
    />
    <rect width="16" height="12" fill="#3C3B6E" />
  </svg>
);

const CNFlag = () => (
  <svg
    className="w-6 h-4 rounded-sm"
    viewBox="0 0 36 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="36" height="24" fill="#DE2910" />
    <polygon
      points="5,4 6,7 9,7 7,9 8,12 5,10 2,12 3,9 1,7 4,7"
      fill="#FFDE00"
    />
  </svg>
);

export const LanguageSwitch = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState<"top" | "bottom">(
    "bottom",
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const languages = [
    { key: "en", label: "English", code: "US", flag: <USFlag /> },
    { key: "zh", label: "中文", code: "CN", flag: <CNFlag /> },
  ];

  const selectedLang =
    languages.find((lang) => lang.key === i18n.language) || languages[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Calculate dropdown position to avoid going off-screen
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const dropdownHeight = 280; // Approximate height of dropdown

      if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
        setDropdownPosition("top");
      } else {
        setDropdownPosition("bottom");
      }
    }
  }, [isOpen]);

  const handleLanguageChange = async (langKey: string) => {
    i18n.changeLanguage(langKey);
    await setConfig("app.language", langKey);
    setIsOpen(false);
    setSearchQuery("");
  };

  const filteredLanguages = languages.filter(
    (lang) =>
      lang.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center">
        <Button
          ref={buttonRef}
          variant="tertiary"
          size="sm"
          className="min-w-[120px] h-9 px-3 gap-2"
          style={{
            backgroundColor: "rgb(40, 40, 40)",
            color: "#fff",
            border: "1px solid rgb(60, 60, 60)",
          }}
          onPress={() => setIsOpen(!isOpen)}
        >
          {selectedLang.flag}
          <span className="text-sm font-medium">{selectedLang.label}</span>
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{ color: "#fff" }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </Button>
      </div>

      {isOpen && (
        <div
          className={`absolute left-0 w-[220px] border rounded-lg shadow-xl z-50 ${
            dropdownPosition === "bottom" ? "top-full mt-2" : "bottom-full mb-2"
          }`}
          style={{
            backgroundColor: "rgb(20, 20, 20)",
            borderColor: "rgb(50, 50, 50)",
          }}
        >
          <div
            className="p-2 border-b"
            style={{ borderColor: "rgb(50, 50, 50)" }}
          >
            <Input
              placeholder="Search language..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8"
              style={{
                backgroundColor: "rgb(35, 35, 35)",
                color: "#fff",
                border: "1px solid rgb(60, 60, 60)",
              }}
            />
          </div>
          <div
            className="max-h-[200px] overflow-y-auto py-1"
            style={{ backgroundColor: "rgb(20, 20, 20)" }}
          >
            {filteredLanguages.map((lang) => (
              <button
                key={lang.key}
                className="w-full px-3 py-2 flex items-center gap-3 transition-colors"
                style={{
                  backgroundColor:
                    i18n.language === lang.key
                      ? "rgb(45, 45, 45)"
                      : "transparent",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (i18n.language !== lang.key) {
                    e.currentTarget.style.backgroundColor = "rgb(35, 35, 35)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (i18n.language !== lang.key) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
                onClick={() => handleLanguageChange(lang.key)}
              >
                <div className="flex-shrink-0">{lang.flag}</div>
                <div className="flex flex-col flex-1 items-start">
                  <span className="text-sm font-medium">{lang.label}</span>
                  <span
                    className="text-xs"
                    style={{ color: "rgb(150, 150, 150)" }}
                  >
                    {lang.code}
                  </span>
                </div>
                {i18n.language === lang.key && (
                  <svg
                    className="w-4 h-4"
                    style={{ color: "#4CAF50" }}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
