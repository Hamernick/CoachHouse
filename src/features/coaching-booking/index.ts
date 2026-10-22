export { CoachingBookingPage } from "./components"
export {
  COACHING_PATH,
  escapeIcsText,
  formatIcsDate,
  listDefaultCoaches,
  normalizeCoachId,
} from "./lib"
export type {
  CoachingBookingPageData,
  CoachingBookingRecord,
  CoachingBookingStatus,
  CoachingCoach,
  CoachingCoachId,
  CoachingCreditSummary,
  CoachingPriceTier,
  CoachingSlot,
} from "./types"

export { AdminCoachingCreditsPanel } from "./components"
export { loadAdminCoachingCredits } from "./loaders"
export {
  loadCoachingCreditsAction,
  issueCoachingCreditsAction,
  manageStaffCoachingBookingAction,
} from "./actions"
export { coachingCalendarCron } from "./handlers"
export { legacyCoachingSchedule } from "./handlers"

export { buildCoachingCalendarTitle } from "./lib/calendar-title"
export { loadCoachingClientName } from "./server/coaching-client-name"
export { getGoogleCoachingParticipantEmail } from "./server/google-calendar"
export {
  COACHING_JOINT_COACH_IDS, COACHING_JOINT_COACH_LABEL, COACHING_JOINT_PRIMARY_COACH_ID,
  COACHING_SESSION_MINUTES, getValidGoogleCalendarEventUrl, getValidGoogleMeetUrl,
} from "./lib"
