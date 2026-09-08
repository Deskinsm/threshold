import { createFileRoute } from "@tanstack/react-router";
import { ThresholdApp } from "@/components/game/ThresholdApp";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <ThresholdApp />;
}
