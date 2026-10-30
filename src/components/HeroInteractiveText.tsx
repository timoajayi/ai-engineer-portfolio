"use client";

import { useEffect, useRef } from "react";
import "./HeroInteractiveText.css";

export default function HeroInteractiveText({ text }: { text: string }) {
  const textRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return;

    const heading = element.closest("h1, h2, h3") ?? element;
    const words = Array.from(
      element.querySelectorAll<HTMLElement>(".hero-interactive-word")
    );
    const letters = Array.from(
      element.querySelectorAll<HTMLElement>(".hero-interactive-letter")
    );
    const motion = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)"
    );
    let frame: number | null = null;
    let pointer = { x: 0, y: 0 };

    function reset() {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      letters.forEach((letter) => {
        letter.style.removeProperty("--hero-letter-lift");
        letter.style.removeProperty("--hero-letter-scale");
      });
    }

    function update() {
      frame = null;
      // Read untransformed word/letter geometry before writing any transforms.
      const positions = words.flatMap((word) => {
        const bounds = word.getBoundingClientRect();
        return Array.from(word.children, (child) => {
          const letter = child as HTMLElement;
          return {
            letter,
            x: bounds.left + letter.offsetLeft + letter.offsetWidth / 2,
            y: bounds.top + word.offsetHeight / 2,
          };
        });
      });

      positions.forEach(({ letter, x, y }) => {
        const distance = Math.hypot(pointer.x - x, pointer.y - y);
        const influence = Math.max(0, 1 - distance / 100) ** 2;
        letter.style.setProperty(
          "--hero-letter-lift",
          `${(-1.8 * influence).toFixed(3)}px`
        );
        letter.style.setProperty(
          "--hero-letter-scale",
          (1 + 0.018 * influence).toFixed(4)
        );
      });
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;
      pointer = { x: event.clientX, y: event.clientY };
      if (frame === null) frame = window.requestAnimationFrame(update);
    }

    function syncInteraction() {
      heading.removeEventListener("pointermove", handlePointerMove);
      heading.removeEventListener("pointerleave", reset);
      window.removeEventListener("blur", reset);
      reset();

      if (motion.matches) {
        heading.addEventListener("pointermove", handlePointerMove, { passive: true });
        heading.addEventListener("pointerleave", reset);
        window.addEventListener("blur", reset);
      }
    }

    syncInteraction();
    motion.addEventListener("change", syncInteraction);

    return () => {
      motion.removeEventListener("change", syncInteraction);
      heading.removeEventListener("pointermove", handlePointerMove);
      heading.removeEventListener("pointerleave", reset);
      window.removeEventListener("blur", reset);
      reset();
    };
  }, [text]);

  return (
    <span ref={textRef}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.split(" ").map((word, wordIndex) => (
          <span key={wordIndex}>
            {wordIndex > 0 && " "}
            <span className="hero-interactive-word">
              {Array.from(word).map((letter, letterIndex) => (
                <span key={letterIndex} className="hero-interactive-letter">
                  {letter}
                </span>
              ))}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}
