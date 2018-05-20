/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

import { Document } from 'mongoose';
import { VpdbQuotaConfigPlan } from '../common/types/config';

/**
 * The user model as it comes from the database.
 */
export interface User extends Document {
	id?: string;
	name?: string;
	username?: string;
	email?: string;
	email_status?: UserEmailStatus;
	emails?: string[];
	roles?: string[];
	_plan?: string;
	is_local?: boolean;
	providers?: UserProviders;
	password_hash?: string;
	password_salt?: string;
	thumb?: string;
	location?: string;
	preferences?: UserPreferences;
	credits?: number;
	counter?: UserCounter;
	created_at?: Date;
	is_active?: boolean;
	validated_emails?: string[];
	channel_config?: {
		subscribe_to_starred: boolean;
		subscribed_releases: string[];
		api_key: string;
	};

	provider?: string;
	provider_id?: string;
	gravatar_id?: string;
	plan?: {
		id: string;
		app_tokens_enabled: boolean;
		push_notifications_enabled: boolean;
	};
	[key:string]:any;

	planConfig?:VpdbQuotaConfigPlan;

	/**
	 * Checks if the passwords are the same
	 * @param {string} plainText Plaintext password
	 * @return {boolean} True if match, false otherwise.
	 */
	authenticate?(plainText: string): boolean;

	/**
	 * Creates a random salt
	 * @return {string} Random salt
	 */
	makeSalt?(): string;

	/**
	 * Hashes a password with previously set salt.
	 * @param {string} password Plain text password
	 * @return {string} Hex-encoded hash
	 */
	hashPassword?(password:string):string;

	/**
	 * Checks if password has been set.
	 * @return {boolean}
	 */
	passwordSet?():boolean;

	/**
	 * Checks if the user has at least one of the given roles
	 * @param {string | string[]} role Roles to check
	 * @return {boolean} True if at least one role matches, false otherwise.
	 */
	hasRole?(role: string | string[]): boolean;
}

export interface UserCounter extends Document {
	comments?: number;
	downloads?: number;
	stars?: number;
}

export interface UserPreferences extends Document {
	tablefile_name: string;
	flavor_tags: any;
	notify_release_moderation_status: boolean;
	notify_release_validation_status: boolean;
	notify_backglass_moderation_status: boolean;
	notify_game_requests: boolean;
	notify_created_release_comments: boolean;
	notify_created_release_followers: boolean;
	notify_mentions: boolean;
	contributor_notify_game_request_created: boolean;
	moderator_notify_release_submitted: boolean;
	moderator_notify_release_auto_approved: boolean;
	moderator_notify_release_commented: boolean;
	moderator_notify_backglass_submitted: boolean;
	moderator_notify_backglass_auto_approved: boolean;

	[key: string]: any;
}

export interface UserProviders {
	[key: string]: {
		id: string;
		name: string;
		emails: string[];
		created_at: Date;
		modified_at: Date;
		profile?: object;

		/**
		 * Returned in API
		 */
		provider?: string;
	}
}

export interface UserEmailStatus {
	code?: string;
	token?: string;
	expires_at?: Date;
	value?: string;
}