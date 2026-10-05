CREATE TABLE `lesson_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`lesson_id` integer NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`exercises_done` integer DEFAULT 0 NOT NULL,
	`exercises_total` integer DEFAULT 0 NOT NULL,
	`score` real,
	`completed_at` integer,
	`last_practiced_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lesson_progress_user_lesson_uq` ON `lesson_progress` (`user_id`,`lesson_id`);--> statement-breakpoint
CREATE INDEX `lesson_progress_user_idx` ON `lesson_progress` (`user_id`);