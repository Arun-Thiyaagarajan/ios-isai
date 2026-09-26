import { and, desc, eq } from 'drizzle-orm';

import { favorites } from '../schema';
import type { AppDatabase, FavoriteType } from '../types';

export function isFavorite(db: AppDatabase, entityType: FavoriteType, entityId: number): boolean {
  const row = db
    .select({ id: favorites.entityId })
    .from(favorites)
    .where(and(eq(favorites.entityType, entityType), eq(favorites.entityId, entityId)))
    .get();
  return row !== undefined;
}

export function setFavorite(
  db: AppDatabase,
  entityType: FavoriteType,
  entityId: number,
  favorite: boolean,
): void {
  if (favorite) {
    db.insert(favorites).values({ entityType, entityId }).onConflictDoNothing().run();
  } else {
    db.delete(favorites)
      .where(and(eq(favorites.entityType, entityType), eq(favorites.entityId, entityId)))
      .run();
  }
}

/** Flips the favorite state and returns the new value. */
export function toggleFavorite(db: AppDatabase, entityType: FavoriteType, entityId: number): boolean {
  const next = !isFavorite(db, entityType, entityId);
  setFavorite(db, entityType, entityId, next);
  return next;
}

/** Most recently favorited first. */
export function listFavoriteIds(db: AppDatabase, entityType: FavoriteType, limit = 500): number[] {
  return db
    .select({ id: favorites.entityId })
    .from(favorites)
    .where(eq(favorites.entityType, entityType))
    .orderBy(desc(favorites.createdAt))
    .limit(limit)
    .all()
    .map((row) => row.id);
}
