import { createFileRoute } from "@tanstack/react-router";
import { ThresholdApp } from "@/components/game/ThresholdApp";
import { GameErrorBoundary } from "@/components/game/GameErrorBoundary";

export const Route = createFileRoute("/")({ component: Home });

/**
 * Exported on purpose. TanStack Start always code-splits route components;
 * an exported identifier stays in the main bundle. That avoids a second
 * fetch of `index.tsx?tsr-split=component`, which is what was blanking
 * the live preview.
 */
export function Home() {
  return (
    <GameErrorBoundary>
      <ThresholdApp />
    </GameErrorBoundary>
  );
}
