import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState } from "@/game";

type Cue = "confirm" | "quarter" | "delivery" | "release" | "alert" | "ending";
const NOTES: Record<Cue, number[]> = {
  confirm: [440],
  quarter: [220, 330],
  delivery: [330, 440, 660],
  release: [262, 392, 524],
  alert: [196, 165],
  ending: [262, 330, 392, 524],
};

/** Presentation only: observes committed state and never touches the game's RNG. */
export function useGameSound(state: GameState, started: boolean) {
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");
  const audio = useRef<AudioContext | null>(null);
  const master = useRef<GainNode | null>(null);
  const voices = useRef(new Set<OscillatorNode>());
  const previous = useRef(state);
  const active = useRef(false);
  const lastCue = useRef(-1);

  const play = useCallback((cue: Cue) => {
    const ctx = audio.current;
    if (!active.current || !ctx || ctx.state !== "running" || !master.current || document.hidden) return;
    if (ctx.currentTime - lastCue.current < 0.08) return;
    lastCue.current = ctx.currentTime;
    voices.current.forEach((voice) => {
      try {
        voice.stop();
      } catch {
        /* already ended */
      }
    });
    voices.current.clear();
    NOTES[cue].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = ctx.currentTime + index * 0.095;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.15, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.19);
      oscillator.connect(gain);
      gain.connect(master.current!);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        voices.current.delete(oscillator);
      };
      voices.current.add(oscillator);
      oscillator.start(at);
      oscillator.stop(at + 0.2);
    });
  }, []);

  const toggle = useCallback(() => {
    if (active.current) {
      active.current = false;
      setEnabled(false);
      if (audio.current && master.current) master.current.gain.setTargetAtTime(0, audio.current.currentTime, 0.015);
      return;
    }
    try {
      const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) throw new Error("unsupported");
      if (!audio.current || audio.current.state === "closed") {
        audio.current = new Constructor();
        master.current = audio.current.createGain();
        master.current.connect(audio.current.destination);
      }
      const resume = audio.current.resume();
      active.current = true;
      setEnabled(true);
      setError("");
      master.current!.gain.setTargetAtTime(0.35, audio.current.currentTime, 0.015);
      void resume
        .then(() => {
          if (active.current) play("confirm");
        })
        .catch(() => {
          active.current = false;
          setEnabled(false);
          setError("Sound could not start. Tap to retry.");
        });
    } catch {
      active.current = false;
      setEnabled(false);
      setError("Sound is unavailable in this browser.");
    }
  }, [play]);

  useEffect(() => {
    const prev = previous.current;
    previous.current = state;
    if (!started || prev === state || prev.seed !== state.seed) return;
    if (state.t < prev.t) return;
    // Imported/new games can replace entire histories. Only sonify appended committed events.
    if (prev.events.length && !state.events.some((e) => e.id === prev.events[0].id && e.text === prev.events[0].text)) return;
    const added = state.events.filter((e) => e.id > prev.eventSeq);
    if (state.over && !prev.over) play(state.over === "insolvent" || state.over === "asi_bad" ? "alert" : "ending");
    else if ((!prev.pendingEmergency && state.pendingEmergency) || added.some((e) => e.type === "incident")) play("alert");
    else if (added.some((e) => e.type === "delivery")) play("delivery");
    else if (state.releases.length > prev.releases.length) play("release");
    else if (state.t > prev.t) play("quarter");
    else if (state.actions < prev.actions || state.raises > prev.raises) play("confirm");
  }, [state, started, play]);

  useEffect(() => {
    const visibility = () => {
      const ctx = audio.current;
      if (!ctx) return;
      if (document.hidden) void ctx.suspend().catch(() => {});
      else if (active.current) void ctx.resume().catch(() => {});
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      active.current = false;
      voices.current.forEach((voice) => {
        try {
          voice.stop();
        } catch {
          /* already ended */
        }
      });
      voices.current.clear();
      if (audio.current) void audio.current.close().catch(() => {});
      audio.current = null;
      master.current = null;
    };
  }, []);

  return { enabled, error, toggle };
}
