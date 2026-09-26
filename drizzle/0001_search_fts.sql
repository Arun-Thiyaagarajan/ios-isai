-- Global search index across songs, artists, albums, genres and playlists.
-- Maintained by the app (search repo) after scan batches and playlist edits.
-- unicode61 + remove_diacritics 2: "beyonce" matches "Beyoncé".
-- prefix='2 3': fast prefix queries while typing ("lov*").
CREATE VIRTUAL TABLE `search_fts` USING fts5(
	`entity_type` UNINDEXED,
	`entity_id` UNINDEXED,
	`primary_text`,
	`secondary_text`,
	tokenize = 'unicode61 remove_diacritics 2',
	prefix = '2 3'
);
