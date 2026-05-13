-- Remove duplicate reactions keeping only the latest per (messageId, userId)
DELETE FROM "message_reactions" a
USING "message_reactions" b
WHERE a.id < b.id
  AND a.message_id = b.message_id
  AND a.user_id = b.user_id;

-- Drop old unique constraint on (message_id, user_id, emoji)
DROP INDEX IF EXISTS "message_reactions_message_id_user_id_emoji_key";

-- Add new unique constraint on (message_id, user_id)
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_user_id_key" UNIQUE ("message_id", "user_id");
