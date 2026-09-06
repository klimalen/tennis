# Data Model — Tennis Ecosystem App

## Принципы проектирования

- **UUID** везде — Supabase default, безопасно для внешних ссылок
- **PostGIS geography(Point, 4326)** для геолокации — радиусные запросы «рядом со мной»
- **Soft delete** (`deleted_at`) на критичных сущностях
- **Денормализованные счётчики** (`total_matches`, `rating`, `likes_count`) — обновляются триггерами, чтобы не считать агрегаты на лету
- **JSONB `metadata`** там, где структура может меняться (настройки, параметры уведомлений)
- **Единая таблица `profiles`** вместо разных таблиц для игрока/тренера/менеджера клуба — роли через флаги
- **Мультиспорт с первого дня** — поле `sport` на ключевых сущностях, сейчас всегда `tennis`

---

## Enums

```sql
sport_type         tennis | padel | squash | pickleball | badminton
play_format        singles | doubles | mixed_doubles
play_style         recreational | competitive | both
surface_type       clay | hard | grass | carpet | synthetic
court_environment  indoor | outdoor
skill_level        -- числовой 1.0–7.0 (как UTR), не enum
game_status        draft | open | confirmed | completed | cancelled
booking_status     pending | confirmed | cancelled | completed | refunded
result_status      pending | confirmed | disputed
session_type       individual | group
tournament_format  single_elimination | double_elimination | round_robin | ladder
message_type       text | game_invite | system | media
post_type          regular | match_result | achievement | review
payment_status     pending | processing | completed | failed | refunded
target_type        player | coach | club   -- для unified reviews
```

---

## 1. Пользователи и профили

### `profiles`
Расширение `auth.users` Supabase. Один человек — один профиль, роли через флаги.

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | = auth.users.id |
| username | text unique | |
| full_name | text | |
| avatar_url | text | |
| bio | text | «О себе» |
| birth_year | int | Только год — privacy |
| gender | text | |
| location | geography(Point) | Текущее местоположение |
| city_id | uuid FK cities | |
| neighborhood | text | Район |
| sport | sport_type | Основной вид спорта |
| skill_level_self | numeric(3,1) | Self-reported 1.0–7.0 |
| skill_level_computed | numeric(3,1) | Вычисленный системой |
| skill_level_verified_by | uuid FK profiles | Тренер, подтвердивший уровень |
| years_playing | int | |
| preferred_surfaces | surface_type[] | |
| preferred_formats | play_format[] | |
| play_style | play_style | |
| preferred_days | int[] | 0=вс, 1=пн … 6=сб |
| preferred_time_start | time | |
| preferred_time_end | time | |
| max_travel_km | int | Радиус готовности ехать |
| looking_for | text | «Кого ищу» |
| is_coach | bool | Флаг тренерского профиля |
| is_club_manager | bool | Флаг менеджера клуба |
| reliability_score | numeric(4,1) | 0–100, вычисляется |
| total_matches | int | Денормализованный счётчик |
| identity_verified | bool | |
| stripe_customer_id | text | |
| last_active_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz | Soft delete |

### `coach_profiles`
Дополнительные данные тренера. Существует только если `profiles.is_coach = true`.

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK FK profiles | |
| tagline | text | Короткий слоган |
| experience_years | int | |
| certifications | text[] | |
| specializations | text[] | serve, footwork, tactics… |
| teaches_levels | numeric[] | Диапазон уровней учеников |
| languages | text[] | |
| hourly_rate | numeric | |
| currency | text | |
| stripe_account_id | text | Stripe Connect |
| rating | numeric(3,2) | Вычисляется из отзывов |
| total_reviews | int | |
| video_intro_url | text | |

### `follows`
| Поле | Тип |
|------|-----|
| follower_id | uuid FK profiles |
| following_id | uuid FK profiles |
| created_at | timestamptz |
| PK | (follower_id, following_id) |

---

## 2. Клубы и корты

### `clubs`

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| name | text | |
| slug | text unique | Для URL |
| description | text | |
| location | geography(Point) | |
| address | text | |
| city_id | uuid FK cities | |
| phone | text | |
| email | text | |
| website | text | |
| logo_url | text | |
| cover_url | text | |
| amenities | text[] | parking, shower, locker, cafe, equipment_rental |
| rating | numeric(3,2) | |
| total_reviews | int | |
| stripe_account_id | text | Stripe Connect |
| owner_id | uuid FK profiles | |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz | |

### `club_media`
| Поле | Тип |
|------|-----|
| id | uuid PK |
| club_id | uuid FK clubs |
| url | text |
| order | int |
| created_at | timestamptz |

### `courts`
Один корт внутри клуба.

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| club_id | uuid FK clubs | |
| name | text | «Корт 1», «Центральный» |
| surface | surface_type | |
| environment | court_environment | indoor/outdoor |
| has_lighting | bool | |
| price_per_hour | numeric | |
| currency | text | |
| min_duration_minutes | int | default 60 |
| max_players | int | default 4 |
| is_active | bool | |

### `court_slots`
Доступные временные слоты. Могут генерироваться автоматически по расписанию или создаваться вручную.

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| court_id | uuid FK courts | |
| starts_at | timestamptz | |
| ends_at | timestamptz | |
| status | available \| booked \| blocked | |
| price_override | numeric | Если цена отличается от court.price_per_hour |

---

## 3. Игры и матчи

### `games`
Центральная сущность — любое запланированное событие игры.

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| creator_id | uuid FK profiles | |
| sport | sport_type | |
| format | play_format | |
| play_style | play_style | |
| skill_level_min | numeric | |
| skill_level_max | numeric | |
| scheduled_at | timestamptz | |
| duration_minutes | int | |
| location | geography(Point) | Приблизительное место |
| city_id | uuid FK cities | |
| neighborhood | text | |
| court_id | uuid FK courts | Заполняется после бронирования |
| court_booking_id | uuid FK court_bookings | |
| status | game_status | |
| is_open | bool | Open Game — могут присоединиться другие |
| max_players | int | |
| notes | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `game_participants`

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| game_id | uuid FK games | |
| player_id | uuid FK profiles | |
| status | invited \| accepted \| declined \| cancelled | |
| team | int | 1 или 2 для doubles |
| invited_at | timestamptz | |
| responded_at | timestamptz | |

### `match_results`

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| game_id | uuid FK games unique | |
| winner_id | uuid FK profiles | Для singles |
| winning_team | int | Для doubles |
| status | result_status | |
| submitted_by | uuid FK profiles | |
| confirmed_by | uuid FK profiles | |
| played_at | timestamptz | |
| created_at | timestamptz | |

### `match_sets`

| Поле | Тип |
|------|-----|
| id | uuid PK |
| match_result_id | uuid FK match_results |
| set_number | int |
| score_p1 | int |
| score_p2 | int |
| tiebreak_p1 | int |
| tiebreak_p2 | int |

---

## 4. Бронирование и платежи

### `court_bookings`

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| court_id | uuid FK courts | |
| court_slot_id | uuid FK court_slots | |
| booked_by | uuid FK profiles | |
| game_id | uuid FK games | |
| starts_at | timestamptz | |
| ends_at | timestamptz | |
| total_amount | numeric | |
| currency | text | |
| status | booking_status | |
| stripe_payment_intent_id | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `booking_splits`
Split payment — каждый участник платит свою долю.

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| booking_id | uuid FK court_bookings | |
| player_id | uuid FK profiles | |
| amount | numeric | |
| status | payment_status | |
| stripe_payment_intent_id | text | |

---

## 5. Тренеры и занятия

### `coach_sessions`
Индивидуальные или групповые занятия.

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| coach_id | uuid FK profiles | |
| title | text | |
| description | text | |
| session_type | session_type | individual / group |
| skill_level_min | numeric | |
| skill_level_max | numeric | |
| scheduled_at | timestamptz | |
| duration_minutes | int | |
| max_participants | int | |
| price_per_participant | numeric | |
| currency | text | |
| court_id | uuid FK courts | |
| location | geography(Point) | |
| status | game_status | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `coach_session_bookings`

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| session_id | uuid FK coach_sessions | |
| player_id | uuid FK profiles | |
| status | booking_status | |
| amount | numeric | |
| stripe_payment_intent_id | text | |
| created_at | timestamptz | |

---

## 6. Отзывы и рейтинг

### `reviews`
Единая таблица для отзывов на игроков, тренеров и клубы.

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| reviewer_id | uuid FK profiles | |
| target_id | uuid | Профиль или клуб |
| target_type | target_type | player / coach / club |
| game_id | uuid FK games | Контекст отзыва на игрока |
| session_id | uuid FK coach_sessions | Контекст отзыва на тренера |
| overall_rating | int | 1–5 |
| punctuality | int | 1–5, для игроков |
| fair_play | int | 1–5, для игроков |
| friendliness | int | 1–5, для игроков |
| teaching_quality | int | 1–5, для тренеров |
| communication | int | 1–5, для тренеров |
| content | text | Текст отзыва |
| is_public | bool | |
| created_at | timestamptz | |

### `player_skill_history`
История изменения рейтинга — для графика прогресса.

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| player_id | uuid FK profiles | |
| sport | sport_type | |
| rating | numeric | Значение после матча |
| delta | numeric | Изменение |
| game_id | uuid FK games | |
| reason | text | match / tournament / coach_verified / assessment |
| computed_at | timestamptz | |

---

## 7. Соревнования

### `tournaments`

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| title | text | |
| description | text | |
| organizer_id | uuid FK profiles | |
| club_id | uuid FK clubs | |
| sport | sport_type | |
| format | tournament_format | |
| play_format | play_format | |
| skill_level_min | numeric | |
| skill_level_max | numeric | |
| max_participants | int | |
| entry_fee | numeric | |
| currency | text | |
| starts_at | timestamptz | |
| ends_at | timestamptz | |
| registration_deadline | timestamptz | |
| location | geography(Point) | |
| city_id | uuid FK cities | |
| status | game_status | |
| prize_description | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `tournament_participants`

| Поле | Тип |
|------|-----|
| id | uuid PK |
| tournament_id | uuid FK tournaments |
| player_id | uuid FK profiles |
| partner_id | uuid FK profiles | -- doubles
| status | registered \| confirmed \| withdrawn |
| seed | int |
| registered_at | timestamptz |
| payment_status | payment_status |

### `tournament_matches`

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| tournament_id | uuid FK tournaments | |
| round | int | |
| match_number | int | Позиция в сетке |
| player1_id | uuid FK profiles | |
| player2_id | uuid FK profiles | |
| scheduled_at | timestamptz | |
| court_id | uuid FK courts | |
| match_result_id | uuid FK match_results | |
| status | game_status | |

### `leagues`

| Поле | Тип |
|------|-----|
| id | uuid PK |
| title | text |
| description | text |
| organizer_id | uuid FK profiles |
| sport | sport_type |
| city_id | uuid FK cities |
| location | geography(Point) |
| is_public | bool |
| created_at | timestamptz |

### `league_seasons`

| Поле | Тип |
|------|-----|
| id | uuid PK |
| league_id | uuid FK leagues |
| title | text |
| starts_at | date |
| ends_at | date |
| status | upcoming \| active \| completed |

### `league_divisions`

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| season_id | uuid FK league_seasons | |
| name | text | «Division 1» |
| level | int | 1 = высший |
| skill_level_min | numeric | |
| skill_level_max | numeric | |
| max_players | int | |

### `league_memberships`

| Поле | Тип |
|------|-----|
| id | uuid PK |
| division_id | uuid FK league_divisions |
| player_id | uuid FK profiles |
| points | int |
| matches_played | int |
| wins | int |
| losses | int |
| rank | int |
| joined_at | timestamptz |

---

## 8. Социальный слой

### `posts`

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| author_id | uuid FK profiles | |
| content | text | |
| post_type | post_type | |
| game_id | uuid FK games | Ссылка на матч |
| match_result_id | uuid FK match_results | |
| location | geography(Point) | |
| likes_count | int | Денормализован |
| comments_count | int | Денормализован |
| is_public | bool | |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz | |

### `post_media`

| Поле | Тип |
|------|-----|
| id | uuid PK |
| post_id | uuid FK posts |
| media_type | photo \| video |
| url | text |
| thumbnail_url | text |
| width | int |
| height | int |
| duration_seconds | int |
| order | int |

### `post_likes`
| Поле | Тип |
|------|-----|
| post_id | uuid FK posts |
| user_id | uuid FK profiles |
| created_at | timestamptz |
| PK | (post_id, user_id) |

### `post_comments`

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| post_id | uuid FK posts | |
| author_id | uuid FK profiles | |
| parent_id | uuid FK post_comments | Для ответов |
| content | text | |
| created_at | timestamptz | |
| deleted_at | timestamptz | |

---

## 9. Сообщения

### `conversations`

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| type | direct \| game_group \| tournament_group | |
| game_id | uuid FK games | |
| tournament_id | uuid FK tournaments | |
| title | text | Для групповых |
| last_message_at | timestamptz | Для сортировки |
| created_at | timestamptz | |

### `conversation_participants`

| Поле | Тип |
|------|-----|
| conversation_id | uuid FK conversations |
| profile_id | uuid FK profiles |
| joined_at | timestamptz |
| last_read_at | timestamptz |
| is_admin | bool |
| PK | (conversation_id, profile_id) |

### `messages`

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| conversation_id | uuid FK conversations | |
| sender_id | uuid FK profiles | |
| message_type | message_type | |
| content | text | |
| metadata | jsonb | Для структурированных приглашений на игру |
| media_url | text | |
| created_at | timestamptz | |
| deleted_at | timestamptz | |

---

## 10. Достижения и геймификация

### `achievements` (определения)

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| code | text unique | first_match, win_streak_5… |
| title | text | |
| description | text | |
| icon_url | text | |
| sport | sport_type | null = все виды спорта |
| condition_type | text | matches_played, win_streak… |
| condition_value | int | |

### `user_achievements`

| Поле | Тип |
|------|-----|
| id | uuid PK |
| player_id | uuid FK profiles |
| achievement_id | uuid FK achievements |
| earned_at | timestamptz |
| game_id | uuid FK games |

---

## 11. Уведомления

### `notifications`

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| recipient_id | uuid FK profiles | |
| type | text | game_invite, match_result, new_follower… |
| title | text | |
| body | text | |
| data | jsonb | Deep link payload |
| is_read | bool | |
| created_at | timestamptz | |
| read_at | timestamptz | |

---

## 12. Справочники

### `cities`

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| name | text | |
| country_code | text | |
| location | geography(Point) | |
| timezone | text | |
| is_active | bool | Города, где продукт запущен |

---

## Ключевые связи (граф)

```
auth.users
    └── profiles (1:1)
            ├── coach_profiles (1:1, опционально)
            ├── follows (M:M self)
            ├── game_participants ──── games ──── court_bookings ──── courts ──── clubs
            │                           └── match_results ──── match_sets
            │                           └── booking_splits
            ├── coach_session_bookings ─── coach_sessions
            ├── posts ──── post_media
            │        ──── post_likes
            │        ──── post_comments
            ├── reviews (as reviewer или target)
            ├── player_skill_history
            ├── user_achievements ──── achievements
            ├── conversation_participants ──── conversations ──── messages
            ├── notifications
            ├── tournament_participants ──── tournaments ──── tournament_matches
            └── league_memberships ──── league_divisions ──── league_seasons ──── leagues
```

---

## Индексы (критичные для производительности)

```sql
-- Геолокация (PostGIS GIST)
CREATE INDEX idx_profiles_location ON profiles USING GIST (location);
CREATE INDEX idx_clubs_location    ON clubs    USING GIST (location);
CREATE INDEX idx_games_location    ON games    USING GIST (location);
CREATE INDEX idx_coach_sessions_location ON coach_sessions USING GIST (location);

-- Поиск игроков по уровню
CREATE INDEX idx_profiles_skill ON profiles (skill_level_computed, sport);

-- Лента игр
CREATE INDEX idx_games_status_scheduled ON games (status, scheduled_at);
CREATE INDEX idx_games_city_open        ON games (city_id, is_open, scheduled_at);

-- Слоты кортов
CREATE INDEX idx_court_slots_available ON court_slots (court_id, status, starts_at);

-- Социальная лента
CREATE INDEX idx_posts_author    ON posts (author_id, created_at DESC);
CREATE INDEX idx_follows_following ON follows (following_id);

-- Сообщения
CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at DESC);

-- Рейтинг игрока
CREATE INDEX idx_skill_history_player ON player_skill_history (player_id, computed_at DESC);
```
