export function setupScore(isConnected: boolean, health: { good: boolean } | null, hasAgent: boolean): number {
  return (isConnected ? 34 : 0) + (health?.good ? 33 : 0) + (hasAgent ? 33 : 0);
}
