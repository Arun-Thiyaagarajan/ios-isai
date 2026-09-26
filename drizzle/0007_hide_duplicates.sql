ALTER TABLE `songs` ADD `duplicate_of` integer;--> statement-breakpoint
CREATE INDEX `songs_duplicate_idx` ON `songs` (`duplicate_of`);