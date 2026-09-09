import { createFileRoute } from "@tanstack/react-router";
import { ThresholdApp } from "@/components/game/ThresholdApp";
import { GameErrorBoundary } from "@/components/game/GameErrorBoundary";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <GameErrorBoundary>
      <ThresholdApp />
    </GameErrorBoundary>
  );
}
