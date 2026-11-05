import type { TrackingType } from '../constants';

/** Rules that depend on how an exercise is measured; see TRACKING_TYPES. */

/** Timed sets store `durationSec`; all other types store reps. */
export const isTimed = (type: TrackingType) => type === 'duration';

/** Only real loads add up to meaningful volume (weight × reps) and e1RM. */
export const countsVolume = (type: TrackingType) => type === 'weight_reps';

/** A counterweight helps: progress means a *smaller* weight. */
export const lowerWeightIsBetter = (type: TrackingType) => type === 'assisted';

/**
 * Whether recorded sets stay valid when an exercise switches between types.
 * Rep-based types share storage; switching to or from `duration` does not.
 */
export const sameSetStorage = (a: TrackingType, b: TrackingType) => isTimed(a) === isTimed(b);
