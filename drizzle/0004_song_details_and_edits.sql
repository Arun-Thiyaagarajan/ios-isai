CREATE TABLE `song_overrides` (
	`song_id` integer PRIMARY KEY NOT NULL,
	`source_key` text NOT NULL,
	`data_json` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `song_overrides_source_key_unique` ON `song_overrides` (`source_key`);--> statement-breakpoint
ALTER TABLE `songs` ADD `composer` text;--> statement-breakpoint
ALTER TABLE `songs` ADD `comment` text;--> statement-breakpoint
ALTER TABLE `songs` ADD `copyright` text;--> statement-breakpoint
ALTER TABLE `songs` ADD `bpm` integer;--> statement-breakpoint
ALTER TABLE `songs` ADD `artwork_override` text;