"use client";

import { useEffect, useState } from "react";

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > 500);
    }

    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
      title="Back to top"
      className="
        fixed bottom-6 left-1/2 z-50 -translate-x-1/2
        flex h-11 w-11 items-center justify-center
        rounded-full border border-zinc-800
        bg-zinc-950/95 text-lg text-zinc-400
        shadow-xl backdrop-blur
        transition
        hover:border-cyan-400/50
        hover:text-cyan-300
      "
    >
      ↑
    </button>
  );
}
