/**
 * Shared domain constants. Import these instead of hardcoding
 * status/department strings across API routes and libs.
 */

/** DemandRecord statuses considered terminal — excluded from "open" queries. */
export const CLOSED_DEMAND_STATUSES: string[] = ["closed", "completed"];
