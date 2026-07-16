import Dexie, { type Table } from "dexie";
import type { ConversationSummary } from "@/core/application/ports/repositories";

/**
 * IndexedDB (Dexie) read-cache for offline history. Supabase remains the source
 * of truth; this only lets previously loaded conversation lists render when the
 * network is unavailable. Client-only — never import from server code.
 */
class OfflineDb extends Dexie {
  conversations!: Table<ConversationSummary, string>;

  constructor() {
    super("pingo-offline");
    this.version(1).stores({ conversations: "id, updatedAt" });
  }
}

let db: OfflineDb | null = null;
function getDb(): OfflineDb | null {
  if (typeof window === "undefined") return null;
  if (!db) db = new OfflineDb();
  return db;
}

export async function cacheConversations(list: ConversationSummary[]): Promise<void> {
  const database = getDb();
  if (!database) return;
  await database.conversations.clear();
  await database.conversations.bulkPut(list);
}

export async function getCachedConversations(): Promise<ConversationSummary[]> {
  const database = getDb();
  if (!database) return [];
  return database.conversations.orderBy("updatedAt").reverse().toArray();
}
