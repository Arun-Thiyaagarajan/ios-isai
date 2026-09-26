PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_library_roots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform` text NOT NULL,
	`display_name` text NOT NULL,
	`bookmark` text,
	`uri` text,
	`is_enabled` integer DEFAULT true NOT NULL,
	`added_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_library_roots`("id", "platform", "display_name", "bookmark", "uri", "is_enabled", "added_at") SELECT "id", "platform", "display_name", "bookmark", "uri", "is_enabled", "added_at" FROM `library_roots`;--> statement-breakpoint
DROP TABLE `library_roots`;--> statement-breakpoint
ALTER TABLE `__new_library_roots` RENAME TO `library_roots`;--> statement-breakpoint
PRAGMA foreign_keys=ON;