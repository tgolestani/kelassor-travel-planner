CREATE TABLE `budgets` (
	`trip_id` text NOT NULL,
	`category` text NOT NULL,
	`amount` integer,
	`rows` text DEFAULT '[]' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`trip_id`, `category`),
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `cache` (
	`key` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`place_id` text NOT NULL,
	`added_by` text NOT NULL,
	`day` integer,
	`time` text,
	`rooms` integer,
	`restaurant` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trip_place_unique` ON `items` (`trip_id`,`place_id`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`phone` text,
	`role` text NOT NULL,
	`token_hash` text,
	`expires_at` integer,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_unique` ON `members` (`trip_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `phone_trip_unique` ON `members` (`trip_id`,`phone`);--> statement-breakpoint
CREATE TABLE `places` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`lat` real NOT NULL,
	`lon` real NOT NULL,
	`address` text NOT NULL,
	`website` text,
	`image` text,
	`source` text NOT NULL,
	`source_url` text NOT NULL,
	`price` integer,
	`price_basis` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reactions` (
	`item_id` text NOT NULL,
	`user_id` text NOT NULL,
	`value` integer NOT NULL,
	PRIMARY KEY(`item_id`, `user_id`),
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `routes` (
	`trip_id` text PRIMARY KEY NOT NULL,
	`item_ids` text DEFAULT '[]' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`destination` text NOT NULL,
	`month` text NOT NULL,
	`start` text,
	`end` text,
	`created_at` integer NOT NULL
);
