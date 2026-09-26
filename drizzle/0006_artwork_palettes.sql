CREATE TABLE `artwork_palettes` (
	`uri` text PRIMARY KEY NOT NULL,
	`palette_json` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
