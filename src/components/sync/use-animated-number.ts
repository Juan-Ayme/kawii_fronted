"use client";

import { useEffect, useRef, useState } from "react";
import { animate, utils } from "animejs";

/**
 * Cuenta hacia el valor objetivo con interpolación suave (anime.js).
 * Devuelve el número actual a renderizar y un ref opcional para tween.
 */
export function useAnimatedNumber(target: number, opts?: { duration?: number }) {
  const [display, setDisplay] = useState(target);
  const proxy = useRef({ v: target });
  const lastTarget = useRef(target);

  useEffect(() => {
    if (lastTarget.current === target) return;
    lastTarget.current = target;

    const anim = animate(proxy.current, {
      v: target,
      duration: opts?.duration ?? 900,
      ease: "outExpo",
      onUpdate: () => {
        setDisplay(utils.round(proxy.current.v, 0));
      },
    });
    return () => {
      anim.pause();
    };
  }, [target, opts?.duration]);

  return display;
}
