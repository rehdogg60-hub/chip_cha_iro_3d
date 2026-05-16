export interface PlatformSpec {
  id: string;
  x: number;
  z: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  kind?: "grass" | "wood" | "stone";
}

export interface TreatSpec {
  id: string;
  x: number;
  y: number;
  z: number;
  golden?: boolean;
}

export const spawnPoint = { x: -7.5, y: 0.9, z: 0 };
export const checkpointPoint = { x: 1.35, y: 1.85, z: -0.85 };
export const goalPoint = { x: 8.5, y: 1.1, z: 0 };

export const platforms: PlatformSpec[] = [
  { id: "field", x: -6.2, z: 0, y: 0, width: 6.8, depth: 6.2, height: 0.5, kind: "grass" },
  { id: "ramp-base", x: -1.9, z: 0, y: 0.35, width: 2.8, depth: 2.4, height: 0.32, kind: "wood" },
  { id: "mid-platform", x: 1.6, z: -0.8, y: 0.95, width: 2.8, depth: 2.4, height: 0.45, kind: "grass" },
  { id: "stone-hop-a", x: 3.8, z: 1.35, y: 0.65, width: 1.35, depth: 1.2, height: 0.4, kind: "stone" },
  { id: "bridge", x: 5.7, z: 0.15, y: 0.82, width: 2.7, depth: 0.85, height: 0.28, kind: "wood" },
  { id: "goal-platform", x: 8.35, z: 0, y: 0.9, width: 2.8, depth: 3.0, height: 0.5, kind: "grass" }
];

export const treats: TreatSpec[] = [
  { id: "treat-01", x: -8.1, y: 0.85, z: -2.1 },
  { id: "treat-02", x: -7.2, y: 0.85, z: 1.7 },
  { id: "treat-03", x: -6.1, y: 0.85, z: 0.1 },
  { id: "treat-04", x: -5.1, y: 0.85, z: -1.8 },
  { id: "treat-05", x: -4.4, y: 0.85, z: 2.0 },
  { id: "treat-06", x: -2.6, y: 0.98, z: -0.8 },
  { id: "treat-07", x: -1.8, y: 1.1, z: 0.75 },
  { id: "treat-08", x: -0.7, y: 1.25, z: 0 },
  { id: "treat-09", x: 0.85, y: 1.55, z: -1.55 },
  { id: "treat-10", x: 1.75, y: 1.55, z: -0.2 },
  { id: "treat-11", x: 2.45, y: 1.55, z: 0.45 },
  { id: "treat-12", x: 3.75, y: 1.15, z: 1.35 },
  { id: "treat-13", x: 4.9, y: 1.22, z: 0.16 },
  { id: "treat-14", x: 5.7, y: 1.24, z: 0.16 },
  { id: "treat-15", x: 6.5, y: 1.22, z: 0.16 },
  { id: "treat-16", x: 7.65, y: 1.45, z: -1.05 },
  { id: "treat-17", x: 8.2, y: 1.45, z: 1.05 },
  { id: "treat-18", x: 9.1, y: 1.45, z: 0 },
  { id: "treat-19", x: -3.9, y: 0.85, z: 0.2 },
  { id: "treat-20", x: 2.75, y: 1.55, z: -1.15 },
  { id: "gold-01", x: -5.7, y: 1.05, z: -2.55, golden: true },
  { id: "gold-02", x: 1.5, y: 1.9, z: -0.85, golden: true },
  { id: "gold-03", x: 7.9, y: 1.75, z: 0.95, golden: true }
];

export const totalRegularTreats = treats.filter(treat => !treat.golden).length;
export const totalGoldenTreats = treats.filter(treat => treat.golden).length;
