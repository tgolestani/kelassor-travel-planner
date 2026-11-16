ALTER TABLE `items` ADD `booking_status` text DEFAULT 'considering' NOT NULL;--> statement-breakpoint
ALTER TABLE `items` ADD `estimated_cost` integer;--> statement-breakpoint
ALTER TABLE `items` ADD `actual_cost` integer;