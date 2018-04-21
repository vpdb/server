import { Document } from 'mongoose';

/**
 * The user model as it comes from the database.
 */
export interface User extends Document {
	id: string,
	name: string,
	username: string,
	email: string,
	email_status: {
		code?: string,
		token?: string,
		expires_at?: Date,
		value?: string
	},
	emails: string[],
	roles: string[],
	_plan: string,
	is_local: boolean,
	providers: {
		[key: string]: {
			id: string,
			name: string,
			emails: string[],
			created_at: Date,
			modified_at: Date,
			profile: object
		}
	},
	password_hash: string,
	password_salt: string,
	thumb: string,
	location: string,
	preferences: {
		tablefile_name: string,
		flavor_tags: any,
		notify_release_moderation_status: boolean,
		notify_release_validation_status: boolean,
		notify_backglass_moderation_status: boolean,
		notify_game_requests: boolean,
		notify_created_release_comments: boolean,
		notify_created_release_followers: boolean,
		notify_mentions: boolean,
		contributor_notify_game_request_created: boolean,
		moderator_notify_release_submitted: boolean,
		moderator_notify_release_auto_approved: boolean,
		moderator_notify_release_commented: boolean,
		moderator_notify_backglass_submitted: boolean,
		moderator_notify_backglass_auto_approved: boolean,
	},
	credits: number,
	counter: {
		comments: number,
		downloads: number,
		stars: number
	},
	created_at: Date,
	is_active: boolean,
	validated_emails: string[],
	channel_config: {
		subscribe_to_starred: boolean,
		subscribed_releases: string[]
	}
}