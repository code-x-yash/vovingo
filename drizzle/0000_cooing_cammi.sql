CREATE TABLE `achievements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`icon` text DEFAULT '🏅',
	`xp` integer DEFAULT 10 NOT NULL,
	`criteria` text DEFAULT '{}'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `achievements_key_unique` ON `achievements` (`key`);--> statement-breakpoint
CREATE TABLE `ai_analysis` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`subject_type` text NOT NULL,
	`subject_id` integer,
	`provider` text NOT NULL,
	`model` text,
	`prompt_version` text,
	`temperature` real,
	`input` text,
	`output` text,
	`summary` text,
	`scores` text,
	`recommendations` text,
	`latency_ms` integer,
	`tokens_in` integer,
	`tokens_out` integer,
	`success` integer DEFAULT true NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_analysis_user_subject_idx` ON `ai_analysis` (`user_id`,`subject_type`,`subject_id`);--> statement-breakpoint
CREATE INDEX `ai_analysis_created_idx` ON `ai_analysis` (`created_at`);--> statement-breakpoint
CREATE TABLE `answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`response` text,
	`correct` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `answers_user_exercise_idx` ON `answers` (`user_id`,`exercise_id`);--> statement-breakpoint
CREATE INDEX `answers_user_idx` ON `answers` (`user_id`);--> statement-breakpoint
CREATE TABLE `assessment_answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`assessment_id` integer NOT NULL,
	`section` text NOT NULL,
	`question_key` text NOT NULL,
	`response` text,
	`correct` integer DEFAULT false NOT NULL,
	`points` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessment_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `assessment_answers_session_idx` ON `assessment_answers` (`assessment_id`);--> statement-breakpoint
CREATE TABLE `assessment_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text DEFAULT 'placement' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`stage` text DEFAULT 'grammar' NOT NULL,
	`scores` text DEFAULT '{}',
	`profile` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `assessment_sessions_user_idx` ON `assessment_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_accounts_provider_uq` ON `auth_accounts` (`provider`,`provider_account_id`);--> statement-breakpoint
CREATE INDEX `auth_accounts_user_idx` ON `auth_accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `conversation_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`analysis` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `conversation_messages_conv_idx` ON `conversation_messages` (`conversation_id`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`scenario_id` integer,
	`mode` text DEFAULT 'free' NOT NULL,
	`persona` text,
	`title` text DEFAULT 'Conversation',
	`status` text DEFAULT 'active' NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `conversations_user_idx` ON `conversations` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`level` text NOT NULL,
	`category` text DEFAULT 'general' NOT NULL,
	`icon` text DEFAULT '📘' NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courses_slug_unique` ON `courses` (`slug`);--> statement-breakpoint
CREATE TABLE `daily_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`date` text NOT NULL,
	`minutes_target` integer DEFAULT 20 NOT NULL,
	`focus` text,
	`focus_reason` text,
	`focus_mistake_id` integer,
	`items` text DEFAULT '[]' NOT NULL,
	`generated_by` text DEFAULT 'rule' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`completed_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`focus_mistake_id`) REFERENCES `mistakes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_plans_user_date_uq` ON `daily_plans` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`name` text NOT NULL,
	`props` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `events_name_idx` ON `events` (`name`,`created_at`);--> statement-breakpoint
CREATE INDEX `events_user_idx` ON `events` (`user_id`);--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lesson_id` integer,
	`type` text NOT NULL,
	`skill` text NOT NULL,
	`prompt` text NOT NULL,
	`options` text,
	`correct_answer` text,
	`explanation` text NOT NULL,
	`difficulty` real DEFAULT 0.5 NOT NULL,
	`tags` text DEFAULT '[]',
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `exercises_lesson_idx` ON `exercises` (`lesson_id`);--> statement-breakpoint
CREATE INDEX `exercises_skill_idx` ON `exercises` (`skill`);--> statement-breakpoint
CREATE TABLE `learning_goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`goal` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_goals_user_goal_uq` ON `learning_goals` (`user_id`,`goal`);--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`course_id` integer,
	`module_id` integer,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`level` text NOT NULL,
	`summary` text NOT NULL,
	`duration_min` integer DEFAULT 5 NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`skill_focus` text,
	`content` text NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lessons_slug_unique` ON `lessons` (`slug`);--> statement-breakpoint
CREATE INDEX `lessons_course_idx` ON `lessons` (`course_id`);--> statement-breakpoint
CREATE INDEX `lessons_category_idx` ON `lessons` (`category`);--> statement-breakpoint
CREATE TABLE `listening_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`podcast_id` integer NOT NULL,
	`type` text NOT NULL,
	`prompt` text NOT NULL,
	`options` text NOT NULL,
	`correct_index` integer NOT NULL,
	`explanation` text NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`podcast_id`) REFERENCES `podcasts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `listening_questions_podcast_idx` ON `listening_questions` (`podcast_id`);--> statement-breakpoint
CREATE TABLE `listening_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`podcast_id` integer,
	`mode` text DEFAULT 'normal' NOT NULL,
	`answers` text,
	`score` real,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`podcast_id`) REFERENCES `podcasts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `listening_sessions_user_idx` ON `listening_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `mistake_occurrences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`mistake_id` integer NOT NULL,
	`user_mistake_id` integer,
	`session_type` text NOT NULL,
	`session_id` integer,
	`sentence` text NOT NULL,
	`correction` text NOT NULL,
	`is_repeat` integer DEFAULT false NOT NULL,
	`confidence` real DEFAULT 1 NOT NULL,
	`detected_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mistake_id`) REFERENCES `mistakes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_mistake_id`) REFERENCES `user_mistakes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mistake_occurrences_user_mistake_idx` ON `mistake_occurrences` (`user_id`,`mistake_id`);--> statement-breakpoint
CREATE INDEX `mistake_occurrences_detected_idx` ON `mistake_occurrences` (`detected_at`);--> statement-breakpoint
CREATE TABLE `mistakes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`subcategory` text,
	`description` text NOT NULL,
	`wrong_example` text NOT NULL,
	`correct_example` text NOT NULL,
	`why` text NOT NULL,
	`natural_alternative` text,
	`severity` text DEFAULT 'medium' NOT NULL,
	`lesson_id` integer,
	`practice_prompts` text DEFAULT '[]',
	`detection` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mistakes_key_unique` ON `mistakes` (`key`);--> statement-breakpoint
CREATE INDEX `mistakes_category_idx` ON `mistakes` (`category`);--> statement-breakpoint
CREATE TABLE `modules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `modules_course_idx` ON `modules` (`course_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `podcast_transcripts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`podcast_id` integer NOT NULL,
	`order_index` integer NOT NULL,
	`start_ms` integer DEFAULT 0 NOT NULL,
	`end_ms` integer DEFAULT 0 NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`podcast_id`) REFERENCES `podcasts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `podcast_transcripts_podcast_idx` ON `podcast_transcripts` (`podcast_id`);--> statement-breakpoint
CREATE TABLE `podcasts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`topic` text NOT NULL,
	`description` text NOT NULL,
	`level` text NOT NULL,
	`duration_sec` integer DEFAULT 300 NOT NULL,
	`audio_url` text,
	`cover_emoji` text DEFAULT '🎧',
	`published_date` text,
	`featured` integer DEFAULT false NOT NULL,
	`vocabulary_ids` text DEFAULT '[]',
	`published` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `podcasts_slug_unique` ON `podcasts` (`slug`);--> statement-breakpoint
CREATE INDEX `podcasts_topic_idx` ON `podcasts` (`topic`);--> statement-breakpoint
CREATE TABLE `practice_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`exercise_id` integer,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`response` text,
	`correct` integer DEFAULT false NOT NULL,
	`feedback` text,
	`order_index` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `practice_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `practice_items_session_idx` ON `practice_items` (`session_id`);--> statement-breakpoint
CREATE TABLE `practice_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`mistake_id` integer,
	`question_count` integer DEFAULT 0 NOT NULL,
	`correct_count` integer DEFAULT 0 NOT NULL,
	`score` real,
	`duration_sec` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mistake_id`) REFERENCES `mistakes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `practice_sessions_user_idx` ON `practice_sessions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`native_language` text DEFAULT 'hindi',
	`english_level` text,
	`profession` text,
	`learning_style` text DEFAULT 'practice',
	`daily_minutes` integer DEFAULT 20 NOT NULL,
	`target_score` integer,
	`timezone` text DEFAULT 'Asia/Kolkata',
	`native_hints` integer DEFAULT true NOT NULL,
	`preferred_difficulty` real DEFAULT 0.5 NOT NULL,
	`onboarded_at` integer,
	`placement_completed_at` integer,
	`avatar_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_user_id_unique` ON `profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `progress_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`date` text NOT NULL,
	`overall` real DEFAULT 0 NOT NULL,
	`skills` text DEFAULT '{}',
	`wpm` real,
	`filler_rate` real,
	`vocab_diversity` real,
	`speaking_minutes` real DEFAULT 0,
	`notes` text DEFAULT '[]',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `progress_snapshots_user_date_idx` ON `progress_snapshots` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `prompt_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`purpose` text NOT NULL,
	`prompt_version` text NOT NULL,
	`provider` text NOT NULL,
	`model` text,
	`temperature` real,
	`input` text,
	`output` text,
	`latency_ms` integer,
	`tokens_in` integer,
	`tokens_out` integer,
	`success` integer DEFAULT true NOT NULL,
	`error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `prompt_logs_purpose_idx` ON `prompt_logs` (`purpose`,`created_at`);--> statement-breakpoint
CREATE TABLE `reading_passages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`level` text NOT NULL,
	`category` text NOT NULL,
	`paragraphs` text NOT NULL,
	`vocabulary_ids` text DEFAULT '[]',
	`questions` text DEFAULT '[]',
	`published` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reading_passages_slug_unique` ON `reading_passages` (`slug`);--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`difficulty` real DEFAULT 0.5 NOT NULL,
	`persona` text,
	`opening_prompt` text,
	`tags` text DEFAULT '[]',
	`skill_focus` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scenarios_slug_unique` ON `scenarios` (`slug`);--> statement-breakpoint
CREATE INDEX `scenarios_category_idx` ON `scenarios` (`category`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`user_agent` text,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `skill_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`skill` text NOT NULL,
	`score` real DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_scores_user_skill_uq` ON `skill_scores` (`user_id`,`skill`);--> statement-breakpoint
CREATE TABLE `songs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`artist` text NOT NULL,
	`duration_sec` integer DEFAULT 200 NOT NULL,
	`cover_url` text,
	`language` text DEFAULT 'en',
	`level` text DEFAULT 'intermediate',
	`lyrics_provider` text,
	`lyrics_ref` text,
	`synced_lyrics_url` text,
	`license_type` text DEFAULT 'external',
	`metadata` text DEFAULT '{}',
	`published` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `songs_slug_unique` ON `songs` (`slug`);--> statement-breakpoint
CREATE TABLE `speaking_segments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`order_index` integer NOT NULL,
	`start_ms` integer DEFAULT 0 NOT NULL,
	`end_ms` integer DEFAULT 0 NOT NULL,
	`text` text NOT NULL,
	`final` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `speaking_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `speaking_segments_session_idx` ON `speaking_segments` (`session_id`);--> statement-breakpoint
CREATE TABLE `speaking_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`mode` text NOT NULL,
	`scenario_id` integer,
	`prompt` text,
	`duration_sec` integer DEFAULT 0 NOT NULL,
	`transcript` text DEFAULT '',
	`wpm` real,
	`pause_count` integer DEFAULT 0,
	`long_pause_count` integer DEFAULT 0,
	`avg_pause_ms` real,
	`filler_count` integer DEFAULT 0,
	`word_count` integer DEFAULT 0,
	`unique_word_count` integer DEFAULT 0,
	`grammar_score` real,
	`vocabulary_score` real,
	`fluency_score` real,
	`pronunciation_score` real,
	`confidence_score` real,
	`naturalness_score` real,
	`audio_key` text,
	`analysis_id` integer,
	`status` text DEFAULT 'processing' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `speaking_sessions_user_idx` ON `speaking_sessions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `speaking_sessions_status_idx` ON `speaking_sessions` (`status`);--> statement-breakpoint
CREATE TABLE `streaks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`current` integer DEFAULT 0 NOT NULL,
	`longest` integer DEFAULT 0 NOT NULL,
	`last_active_date` text,
	`total_days` integer DEFAULT 0 NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `streaks_user_id_unique` ON `streaks` (`user_id`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`provider` text DEFAULT 'manual',
	`provider_ref` text,
	`started_at` integer,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `subscriptions_user_idx` ON `subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_achievements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`achievement_id` integer NOT NULL,
	`unlocked_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`achievement_id`) REFERENCES `achievements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_achievements_user_ach_uq` ON `user_achievements` (`user_id`,`achievement_id`);--> statement-breakpoint
CREATE INDEX `user_achievements_user_idx` ON `user_achievements` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_mistakes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`mistake_id` integer NOT NULL,
	`occurrences` integer DEFAULT 0 NOT NULL,
	`first_detected_at` integer NOT NULL,
	`last_detected_at` integer NOT NULL,
	`trend` text DEFAULT 'new' NOT NULL,
	`trend_percent` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`severity` text DEFAULT 'medium' NOT NULL,
	`practice_count` integer DEFAULT 0 NOT NULL,
	`last_practiced_at` integer,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mistake_id`) REFERENCES `mistakes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_mistakes_user_mistake_uq` ON `user_mistakes` (`user_id`,`mistake_id`);--> statement-breakpoint
CREATE INDEX `user_mistakes_user_status_idx` ON `user_mistakes` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `user_vocabulary` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`word_id` integer NOT NULL,
	`status` text DEFAULT 'learning' NOT NULL,
	`ease` real DEFAULT 2.5 NOT NULL,
	`interval_days` integer DEFAULT 0 NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`due_at` integer,
	`last_reviewed_at` integer,
	`correct_count` integer DEFAULT 0 NOT NULL,
	`wrong_count` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'manual',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`word_id`) REFERENCES `vocabulary`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_vocabulary_user_word_uq` ON `user_vocabulary` (`user_id`,`word_id`);--> statement-breakpoint
CREATE INDEX `user_vocabulary_due_idx` ON `user_vocabulary` (`user_id`,`due_at`);--> statement-breakpoint
CREATE INDEX `user_vocabulary_status_idx` ON `user_vocabulary` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`name` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`email_verified_at` integer,
	`last_login_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `video_transcripts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer NOT NULL,
	`order_index` integer NOT NULL,
	`start_ms` integer DEFAULT 0 NOT NULL,
	`end_ms` integer DEFAULT 0 NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `video_transcripts_video_idx` ON `video_transcripts` (`video_id`);--> statement-breakpoint
CREATE TABLE `videos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`level` text NOT NULL,
	`category` text NOT NULL,
	`video_url` text NOT NULL,
	`thumbnail_url` text,
	`duration_sec` integer DEFAULT 180 NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `videos_slug_unique` ON `videos` (`slug`);--> statement-breakpoint
CREATE INDEX `videos_category_idx` ON `videos` (`category`);--> statement-breakpoint
CREATE TABLE `vocabulary` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`word` text NOT NULL,
	`definition` text NOT NULL,
	`pronunciation` text,
	`example` text NOT NULL,
	`synonyms` text DEFAULT '[]',
	`antonyms` text DEFAULT '[]',
	`collocations` text DEFAULT '[]',
	`category` text NOT NULL,
	`topic` text,
	`difficulty` real DEFAULT 0.5 NOT NULL,
	`native_gloss` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vocabulary_word_category_uq` ON `vocabulary` (`word`,`category`);--> statement-breakpoint
CREATE INDEX `vocabulary_category_idx` ON `vocabulary` (`category`);--> statement-breakpoint
CREATE TABLE `writing_analyses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`kind` text DEFAULT 'free' NOT NULL,
	`original` text NOT NULL,
	`corrected` text,
	`natural` text,
	`tone` text,
	`scores` text,
	`mistakes` text DEFAULT '[]',
	`feedback` text,
	`analysis_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`analysis_id`) REFERENCES `ai_analysis`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `writing_analyses_user_idx` ON `writing_analyses` (`user_id`,`created_at`);