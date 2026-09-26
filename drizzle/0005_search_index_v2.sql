-- Search index v2: adds `extra_text` (file name, lyrics, comment) next to the title and the
-- artist/album/composer/genre text, so each can be weighted differently when ranking.
-- The index holds only derived data; the app rebuilds it on the next scan or at startup.
DROP TABLE IF EXISTS `search_fts`;
--> statement-breakpoint
CREATE VIRTUAL TABLE `search_fts` USING fts5(
	`entity_type` UNINDEXED,
	`entity_id` UNINDEXED,
	`primary_text`,
	`secondary_text`,
	`extra_text`,
	tokenize = 'unicode61 remove_diacritics 2',
	prefix = '2 3'
);
