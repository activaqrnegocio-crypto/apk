-- Migration: Add type column to push_subscriptions table
-- Created: 2026-06-04

ALTER TABLE `push_subscriptions` 
ADD COLUMN `type` VARCHAR(20) NOT NULL DEFAULT 'vapid' AFTER `user_id`;

-- Add index for type column
CREATE INDEX `push_subscriptions_type_idx` ON `push_subscriptions`(`type`);