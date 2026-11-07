const decisions = {} satisfies Record<string, { because: string }>;

export const disagreements: Record<string, keyof typeof decisions> = {};
