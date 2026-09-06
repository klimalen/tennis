import type {
  SportType,
  PlayFormat,
  PlayStyle,
  SurfaceType,
  CourtEnvironment,
  GameStatus,
  BookingStatus,
  ResultStatus,
  SessionType,
  TournamentFormat,
  MessageType,
  PostType,
  PaymentStatus,
  ReviewTargetType,
  ParticipantStatus,
} from './enums'

export interface GeoPoint {
  lat: number
  lng: number
}

export interface City {
  id: string
  name: string
  country_code: string
  location: GeoPoint
  timezone: string
  is_active: boolean
}

export interface Profile {
  id: string
  username: string
  full_name: string
  avatar_url: string | null
  bio: string | null
  birth_year: number | null
  gender: string | null
  location: GeoPoint | null
  city_id: string | null
  neighborhood: string | null
  sport: SportType
  skill_level_self: number | null
  skill_level_computed: number | null
  skill_level_verified_by: string | null
  years_playing: number | null
  preferred_surfaces: SurfaceType[]
  preferred_formats: PlayFormat[]
  play_style: PlayStyle | null
  preferred_days: number[]
  preferred_time_start: string | null
  preferred_time_end: string | null
  max_travel_km: number | null
  looking_for: string | null
  is_coach: boolean
  is_club_manager: boolean
  reliability_score: number | null
  total_matches: number
  identity_verified: boolean
  last_active_at: string | null
  created_at: string
  updated_at: string
}

export interface CoachProfile {
  id: string
  tagline: string | null
  experience_years: number | null
  certifications: string[]
  specializations: string[]
  teaches_levels: number[]
  languages: string[]
  hourly_rate: number | null
  currency: string
  stripe_account_id: string | null
  rating: number | null
  total_reviews: number
  video_intro_url: string | null
}

export interface Follow {
  follower_id: string
  following_id: string
  created_at: string
}

export interface Club {
  id: string
  name: string
  slug: string
  description: string | null
  location: GeoPoint
  address: string
  city_id: string
  phone: string | null
  email: string | null
  website: string | null
  logo_url: string | null
  cover_url: string | null
  amenities: string[]
  rating: number | null
  total_reviews: number
  owner_id: string
  created_at: string
  updated_at: string
}

export interface ClubMedia {
  id: string
  club_id: string
  url: string
  order: number
  created_at: string
}

export interface Court {
  id: string
  club_id: string
  name: string
  surface: SurfaceType
  environment: CourtEnvironment
  has_lighting: boolean
  price_per_hour: number
  currency: string
  min_duration_minutes: number
  max_players: number
  is_active: boolean
}

export interface CourtSlot {
  id: string
  court_id: string
  starts_at: string
  ends_at: string
  status: 'available' | 'booked' | 'blocked'
  price_override: number | null
}

export interface Game {
  id: string
  creator_id: string
  sport: SportType
  format: PlayFormat
  play_style: PlayStyle
  skill_level_min: number
  skill_level_max: number
  scheduled_at: string
  duration_minutes: number
  location: GeoPoint | null
  city_id: string | null
  neighborhood: string | null
  court_id: string | null
  court_booking_id: string | null
  status: GameStatus
  is_open: boolean
  max_players: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface GameParticipant {
  id: string
  game_id: string
  player_id: string
  status: ParticipantStatus
  team: number | null
  invited_at: string
  responded_at: string | null
}

export interface MatchResult {
  id: string
  game_id: string
  winner_id: string | null
  winning_team: number | null
  status: ResultStatus
  submitted_by: string
  confirmed_by: string | null
  played_at: string
  created_at: string
}

export interface MatchSet {
  id: string
  match_result_id: string
  set_number: number
  score_p1: number
  score_p2: number
  tiebreak_p1: number | null
  tiebreak_p2: number | null
}

export interface CourtBooking {
  id: string
  court_id: string
  court_slot_id: string | null
  booked_by: string
  game_id: string | null
  starts_at: string
  ends_at: string
  total_amount: number
  currency: string
  status: BookingStatus
  stripe_payment_intent_id: string | null
  created_at: string
  updated_at: string
}

export interface BookingSplit {
  id: string
  booking_id: string
  player_id: string
  amount: number
  status: PaymentStatus
  stripe_payment_intent_id: string | null
}

export interface CoachSession {
  id: string
  coach_id: string
  title: string
  description: string | null
  session_type: SessionType
  skill_level_min: number
  skill_level_max: number
  scheduled_at: string
  duration_minutes: number
  max_participants: number
  price_per_participant: number
  currency: string
  court_id: string | null
  location: GeoPoint | null
  status: GameStatus
  created_at: string
  updated_at: string
}

export interface CoachSessionBooking {
  id: string
  session_id: string
  player_id: string
  status: BookingStatus
  amount: number
  stripe_payment_intent_id: string | null
  created_at: string
}

export interface Review {
  id: string
  reviewer_id: string
  target_id: string
  target_type: ReviewTargetType
  game_id: string | null
  session_id: string | null
  overall_rating: number
  punctuality: number | null
  fair_play: number | null
  friendliness: number | null
  teaching_quality: number | null
  communication: number | null
  content: string | null
  is_public: boolean
  created_at: string
}

export interface PlayerSkillHistory {
  id: string
  player_id: string
  sport: SportType
  rating: number
  delta: number
  game_id: string | null
  reason: 'match' | 'tournament' | 'coach_verified' | 'assessment'
  computed_at: string
}

export interface Tournament {
  id: string
  title: string
  description: string | null
  organizer_id: string
  club_id: string | null
  sport: SportType
  format: TournamentFormat
  play_format: PlayFormat
  skill_level_min: number
  skill_level_max: number
  max_participants: number
  entry_fee: number
  currency: string
  starts_at: string
  ends_at: string
  registration_deadline: string
  location: GeoPoint
  city_id: string
  status: GameStatus
  prize_description: string | null
  created_at: string
  updated_at: string
}

export interface TournamentParticipant {
  id: string
  tournament_id: string
  player_id: string
  partner_id: string | null
  status: 'registered' | 'confirmed' | 'withdrawn'
  seed: number | null
  registered_at: string
  payment_status: PaymentStatus
}

export interface TournamentMatch {
  id: string
  tournament_id: string
  round: number
  match_number: number
  player1_id: string | null
  player2_id: string | null
  scheduled_at: string | null
  court_id: string | null
  match_result_id: string | null
  status: GameStatus
}

export interface League {
  id: string
  title: string
  description: string | null
  organizer_id: string
  sport: SportType
  city_id: string
  location: GeoPoint
  is_public: boolean
  created_at: string
}

export interface LeagueSeason {
  id: string
  league_id: string
  title: string
  starts_at: string
  ends_at: string
  status: 'upcoming' | 'active' | 'completed'
}

export interface LeagueDivision {
  id: string
  season_id: string
  name: string
  level: number
  skill_level_min: number
  skill_level_max: number
  max_players: number
}

export interface LeagueMembership {
  id: string
  division_id: string
  player_id: string
  points: number
  matches_played: number
  wins: number
  losses: number
  rank: number
  joined_at: string
}

export interface Post {
  id: string
  author_id: string
  content: string
  post_type: PostType
  game_id: string | null
  match_result_id: string | null
  location: GeoPoint | null
  likes_count: number
  comments_count: number
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface PostMedia {
  id: string
  post_id: string
  media_type: 'photo' | 'video'
  url: string
  thumbnail_url: string | null
  width: number
  height: number
  duration_seconds: number | null
  order: number
}

export interface PostComment {
  id: string
  post_id: string
  author_id: string
  parent_id: string | null
  content: string
  created_at: string
}

export interface Conversation {
  id: string
  type: 'direct' | 'game_group' | 'tournament_group'
  game_id: string | null
  tournament_id: string | null
  title: string | null
  last_message_at: string | null
  created_at: string
}

export interface ConversationParticipant {
  conversation_id: string
  profile_id: string
  joined_at: string
  last_read_at: string | null
  is_admin: boolean
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  message_type: MessageType
  content: string
  metadata: Record<string, unknown> | null
  media_url: string | null
  created_at: string
}

export interface Achievement {
  id: string
  code: string
  title: string
  description: string
  icon_url: string
  sport: SportType | null
  condition_type: string
  condition_value: number
}

export interface UserAchievement {
  id: string
  player_id: string
  achievement_id: string
  earned_at: string
  game_id: string | null
}

export interface Notification {
  id: string
  recipient_id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown>
  is_read: boolean
  created_at: string
  read_at: string | null
}
