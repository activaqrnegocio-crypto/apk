-- Add missing columns to push_subscriptions table (only if they don't exist)
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'vapid' AFTER user_id;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(500) AFTER auth;