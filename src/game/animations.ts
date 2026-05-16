export type ChipAnimationName = "Idle" | "Walk" | "Run" | "Jump" | "Celebrate" | "Fall";

export const defaultAnimation: ChipAnimationName = "Idle";

export const oneShotDurations: Partial<Record<ChipAnimationName, number>> = {
  Jump: 900,
  Celebrate: 1600,
  Fall: 1000
};
