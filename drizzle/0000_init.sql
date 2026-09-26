CREATE TABLE `albums` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`title_sort` text NOT NULL,
	`title_norm` text NOT NULL,
	`album_artist_id` integer,
	`group_hint` text DEFAULT '' NOT NULL,
	`year` integer,
	`artwork_key` text,
	`color_primary` text,
	`color_secondary` text,
	`color_on` text,
	`song_count` integer DEFAULT 0 NOT NULL,
	`total_duration_ms` integer DEFAULT 0 NOT NULL,
	`is_compilation` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`album_artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `albums_identity_idx` ON `albums` (`title_norm`,`album_artist_id`,`group_hint`);--> statement-breakpoint
CREATE INDEX `albums_sort_idx` ON `albums` (`title_sort`);--> statement-breakpoint
CREATE INDEX `albums_artist_idx` ON `albums` (`album_artist_id`);--> statement-breakpoint
CREATE TABLE `artists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`name_sort` text NOT NULL,
	`name_norm` text NOT NULL,
	`artwork_key` text,
	`song_count` integer DEFAULT 0 NOT NULL,
	`album_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `artists_name_norm_unique` ON `artists` (`name_norm`);--> statement-breakpoint
CREATE INDEX `artists_sort_idx` ON `artists` (`name_sort`);--> statement-breakpoint
CREATE TABLE `excluded_paths` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path_prefix` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `excluded_paths_path_prefix_unique` ON `excluded_paths` (`path_prefix`);--> statement-breakpoint
CREATE TABLE `favorites` (
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`entity_type`, `entity_id`)
);
--> statement-breakpoint
CREATE INDEX `favorites_recent_idx` ON `favorites` (`entity_type`,`created_at`);--> statement-breakpoint
CREATE TABLE `folders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`parent_id` integer,
	`path` text NOT NULL,
	`name` text NOT NULL,
	`song_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `folders_path_unique` ON `folders` (`path`);--> statement-breakpoint
CREATE INDEX `folders_parent_idx` ON `folders` (`parent_id`);--> statement-breakpoint
CREATE TABLE `genres` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`name_norm` text NOT NULL,
	`song_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `genres_name_norm_unique` ON `genres` (`name_norm`);--> statement-breakpoint
CREATE TABLE `library_roots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform` text NOT NULL,
	`display_name` text NOT NULL,
	`bookmark` blob,
	`uri` text,
	`is_enabled` integer DEFAULT true NOT NULL,
	`added_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lyrics_cache` (
	`song_id` integer PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`is_synced` integer NOT NULL,
	`content` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `play_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`song_id` integer NOT NULL,
	`started_at` integer NOT NULL,
	`ms_played` integer NOT NULL,
	`completed` integer NOT NULL,
	`context` text,
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `play_events_started_idx` ON `play_events` (`started_at`);--> statement-breakpoint
CREATE INDEX `play_events_song_idx` ON `play_events` (`song_id`);--> statement-breakpoint
CREATE TABLE `playlist_songs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`playlist_id` integer NOT NULL,
	`song_id` integer,
	`position` real NOT NULL,
	`song_fingerprint` text NOT NULL,
	`added_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `playlist_songs_order_idx` ON `playlist_songs` (`playlist_id`,`position`);--> statement-breakpoint
CREATE INDEX `playlist_songs_song_idx` ON `playlist_songs` (`song_id`);--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`artwork_uri` text,
	`kind` text DEFAULT 'manual' NOT NULL,
	`rules_json` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recent_searches` (
	`query` text PRIMARY KEY NOT NULL,
	`used_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `song_artists` (
	`song_id` integer NOT NULL,
	`artist_id` integer NOT NULL,
	`role` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`song_id`, `artist_id`, `role`),
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `song_artists_artist_idx` ON `song_artists` (`artist_id`,`role`);--> statement-breakpoint
CREATE TABLE `song_genres` (
	`song_id` integer NOT NULL,
	`genre_id` integer NOT NULL,
	PRIMARY KEY(`song_id`, `genre_id`),
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`genre_id`) REFERENCES `genres`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `song_genres_genre_idx` ON `song_genres` (`genre_id`);--> statement-breakpoint
CREATE TABLE `song_stats` (
	`song_id` integer PRIMARY KEY NOT NULL,
	`play_count` integer DEFAULT 0 NOT NULL,
	`skip_count` integer DEFAULT 0 NOT NULL,
	`first_played_at` integer,
	`last_played_at` integer,
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `song_stats_play_count_idx` ON `song_stats` (`play_count`);--> statement-breakpoint
CREATE INDEX `song_stats_last_played_idx` ON `song_stats` (`last_played_at`);--> statement-breakpoint
CREATE TABLE `songs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`root_id` integer,
	`uri` text NOT NULL,
	`folder_id` integer,
	`file_name` text NOT NULL,
	`file_size` integer DEFAULT 0 NOT NULL,
	`mime` text,
	`date_added` integer NOT NULL,
	`date_modified` integer NOT NULL,
	`content_sig` text,
	`codec` text,
	`bitrate` integer,
	`sample_rate` integer,
	`bit_depth` integer,
	`channels` integer,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`title` text NOT NULL,
	`title_sort` text NOT NULL,
	`artist_display` text DEFAULT '' NOT NULL,
	`album_id` integer,
	`album_artist_display` text,
	`year` integer,
	`track_no` integer,
	`disc_no` integer,
	`has_art` integer DEFAULT false NOT NULL,
	`artwork_key` text,
	`has_lyrics` integer DEFAULT false NOT NULL,
	`rg_track_gain` real,
	`rg_track_peak` real,
	`rg_album_gain` real,
	`rg_album_peak` real,
	`is_playable` integer DEFAULT true NOT NULL,
	`unplayable_reason` text,
	`is_available` integer DEFAULT true NOT NULL,
	`missing_since` integer,
	`tags_scanned_at` integer,
	`scan_generation` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	FOREIGN KEY (`root_id`) REFERENCES `library_roots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `songs_source_idx` ON `songs` (`source`,`source_id`);--> statement-breakpoint
CREATE INDEX `songs_album_track_idx` ON `songs` (`album_id`,`disc_no`,`track_no`);--> statement-breakpoint
CREATE INDEX `songs_title_sort_idx` ON `songs` (`title_sort`);--> statement-breakpoint
CREATE INDEX `songs_date_added_idx` ON `songs` (`date_added`);--> statement-breakpoint
CREATE INDEX `songs_folder_idx` ON `songs` (`folder_id`);--> statement-breakpoint
CREATE INDEX `songs_available_idx` ON `songs` (`is_available`);--> statement-breakpoint
CREATE INDEX `songs_content_sig_idx` ON `songs` (`content_sig`) WHERE "songs"."content_sig" IS NOT NULL;