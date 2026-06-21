/** Shared OpenCascade tessellation settings for STEP / IGES import. */
export const CAD_TESSELLATION_PARAMS = {
  /** Ratio of average bounding-box size — scales quality to model size. */
  linearDeflectionType: "bounding_box_ratio" as const,
  /** 10% of avg bbox diagonal — fast but still smooth on most CAD parts. */
  linearDeflection: 0.1,
  /** 0.5 rad (~28.6°) — good speed/quality balance for web viewing. */
  angularDeflection: 0.5,
};
