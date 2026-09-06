export type SportType = 'tennis' | 'padel' | 'squash' | 'pickleball' | 'badminton'

export type PlayFormat = 'singles' | 'doubles' | 'mixed_doubles'

export type PlayStyle = 'recreational' | 'competitive' | 'both'

export type SurfaceType = 'clay' | 'hard' | 'grass' | 'carpet' | 'synthetic'

export type CourtEnvironment = 'indoor' | 'outdoor'

export type GameStatus = 'draft' | 'open' | 'confirmed' | 'completed' | 'cancelled'

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'refunded'

export type ResultStatus = 'pending' | 'confirmed' | 'disputed'

export type SessionType = 'individual' | 'group'

export type TournamentFormat =
  | 'single_elimination'
  | 'double_elimination'
  | 'round_robin'
  | 'ladder'

export type MessageType = 'text' | 'game_invite' | 'system' | 'media'

export type PostType = 'regular' | 'match_result' | 'achievement' | 'review'

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'

export type ReviewTargetType = 'player' | 'coach' | 'club'

export type ParticipantStatus = 'invited' | 'accepted' | 'declined' | 'cancelled'

// Skill level: numeric 1.0–7.0 (UTR-like)
// 1.0–2.0 = beginner, 2.0–3.5 = intermediate, 3.5–5.0 = advanced, 5.0+ = competitive/pro
export type SkillLevel = number

export const SKILL_LEVEL_LABELS: Record<string, { min: number; max: number; label: string }> = {
  beginner: { min: 1.0, max: 2.0, label: 'Beginner' },
  intermediate: { min: 2.0, max: 3.5, label: 'Intermediate' },
  advanced: { min: 3.5, max: 5.0, label: 'Advanced' },
  competitive: { min: 5.0, max: 7.0, label: 'Competitive' },
}

export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
