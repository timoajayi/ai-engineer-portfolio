"use client";

import { useState } from "react";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="fixed left-0 top-0 z-50 w-full border-b border-zinc-900/80 bg-zinc-950/75 backdrop-blur-md">
      <nav className="mx-auto max-w-7xl px-6 py-4 lg:px-8">
        <div className="flex items-center justify-between">
          <a
            href="#"
            className="text-lg font-semibold tracking-tight text-white"
            onClick={closeMenu}
          >
            Timothy Ajayi
          </a>

          {/* Desktop navigation */}
          <div className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
            <a href="#projects" className="transition-colors hover:text-white">
              Projects
            </a>

            <a href="#about" className="transition-colors hover:text-white">
              About
            </a>

            <a href="#skills" className="transition-colors hover:text-white">
              Skills
            </a>

            <a href="#contact" className="transition-colors hover:text-white">
              Contact
            </a>

            <div className="flex items-center gap-3 border-l border-zinc-800 pl-8">
              <span className="text-zinc-500">CV</span>

              <a
                href="/Timothy-Ajayi-CV-English.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-white"
              >
                English ↗
              </a>

              <a
                href="/Timothy-Ajayi-Lebenslauf-Deutsch.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-white"
              >
                Deutsch ↗
              </a>
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 text-white transition-colors hover:border-zinc-600 md:hidden"
          >
            {menuOpen ? (
              <span className="text-xl leading-none">×</span>
            ) : (
              <span className="flex flex-col gap-1.5">
                <span className="block h-px w-4 bg-current" />
                <span className="block h-px w-4 bg-current" />
              </span>
            )}
          </button>
        </div>

        {/* Mobile navigation */}
        {menuOpen && (
          <div
            id="mobile-navigation"
            className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl backdrop-blur md:hidden"
          >
            <div className="flex flex-col text-sm">
              <a
                href="#projects"
                onClick={closeMenu}
                className="border-b border-zinc-900 py-3 text-zinc-300 transition-colors hover:text-white"
              >
                Projects
              </a>

              <a
                href="#about"
                onClick={closeMenu}
                className="border-b border-zinc-900 py-3 text-zinc-300 transition-colors hover:text-white"
              >
                About
              </a>

              <a
                href="#skills"
                onClick={closeMenu}
                className="border-b border-zinc-900 py-3 text-zinc-300 transition-colors hover:text-white"
              >
                Skills
              </a>

              <a
                href="#contact"
                onClick={closeMenu}
                className="py-3 text-zinc-300 transition-colors hover:text-white"
              >
                Contact
              </a>
            </div>

            <div className="mt-4 border-t border-zinc-800 pt-4">
              <p className="mb-3 text-xs uppercase tracking-[0.2em] text-zinc-600">
                Curriculum Vitae
              </p>

              <div className="flex gap-5 text-sm">
                <a
                  href="/Timothy-Ajayi-CV-English.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeMenu}
                  className="text-zinc-300 transition-colors hover:text-white"
                >
                  English ↗
                </a>

                <a
                  href="/Timothy-Ajayi-Lebenslauf-Deutsch.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeMenu}
                  className="text-zinc-300 transition-colors hover:text-white"
                >
                  Deutsch ↗
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}