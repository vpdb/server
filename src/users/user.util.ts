import { Context } from 'koa';
import randomstring from 'randomstring';
import { assign, keys, sum, uniq, values } from 'lodash';

import { logger } from '../common/logger';
import { config } from '../common/settings';
import { User } from './user.type';
import { ApiError } from '../common/api.error';
import { Release } from '../releases/release.type';
import { ReleaseVersionFile } from '../releases/release.version.file.type';
import { ContentAuthor } from './content.author.type';
import { Backglass } from '../backglasses/backglass.type';
import { Rating } from '../ratings/rating.type';
import { userMergedDeleted, userMergedKept } from '../common/mailer';
import { Star } from '../stars/star.type';

export class UserUtil {

	public static async createUser(ctx: Context, userObj: User, confirmUserEmail: boolean): Promise<User> {

		let user = new ctx.models.User(assign(userObj, {
			created_at: new Date(),
			roles: ['member'],
			_plan: config.vpdb.quota.defaultPlan
		}));

		if (confirmUserEmail) {
			user.email_status = {
				code: 'pending_registration',
				token: randomstring.generate(16),
				expires_at: new Date(new Date().getTime() + 86400000), // 1d valid
				value: userObj.email
			};
		} else {
			user.email_status = { code: 'confirmed' };
			user.is_active = true;
			user.validated_emails = [userObj.email];
		}
		await user.validate();

		const count = await ctx.models.User.count({}).exec();

		user.roles = count ? ['member'] : ['root'];
		user = await user.save();

		await require('../common/acl').addUserRoles(user.id, user.roles);

		logger.info('[model|user] %s <%s> successfully created with ID "%s" and plan "%s".', count ? 'User' : 'Root user', user.email, user.id, user._plan);
		return user;
	};

	/**
	 * Tries to merge a bunch of users based on request parameters.
	 *
	 * @param {Application.Context} ctx Koa context
	 * @param {User[]} mergeUsers Merge candidates
	 * @param {string} explanation Explanation in case no user ID provided in request
	 * @return {Promise<User>} Merged user on success, rejects on error
	 */
	public static async tryMergeUsers(ctx: Context, mergeUsers: User[], explanation: string): Promise<User> {
		if (ctx.query.merged_user_id) {
			const keepUser = mergeUsers.find(u => u.id === ctx.query.merged_user_id);
			if (keepUser) {
				const otherUsers = mergeUsers.filter(u => u.id !== ctx.query.merged_user_id);
				logger.info('[model|user] Merging users [ %s ] into %s as per query parameter.', otherUsers.map(u => u.id).join(', '), keepUser.id);
				// merge users
				for (let otherUser of otherUsers) {
					await UserUtil.mergeUsers(ctx, keepUser, otherUser, explanation);
				}
				return keepUser;
			} else {
				throw new ApiError('Provided user ID does not match any of the conflicting users.').status(400);
			}
		} else {
			// otherwise, fail and query merge resolution
			throw new ApiError('Conflicted users, must merge.')
				.data({ explanation: explanation, users: mergeUsers.map(u => ctx.serializers.User.detailed(ctx, u)) })
				.status(409);
		}
	};

	/**
	 * Merges one user into another.
	 * @param {Application.Context} ctx Koa context
	 * @param {User} keepUser User to keep
	 * @param {User} mergeUser User to merge into the other and then delete
	 * @param {string} explanation Explanation to put into mail, if null no mail is sent.
	 * @return {Promise<User>} Merged user
	 */
	public static async mergeUsers(ctx: Context, keepUser: User, mergeUser: User, explanation:string): Promise<User> {

		logger.info('[model|user] Merging %s into %s...', mergeUser.id, keepUser.id);
		if (keepUser.id === mergeUser.id) {
			return Promise.reject('Cannot merge user ' + keepUser.id + ' into itself!');
		}
		let num = 0;
		let queries:Array<any>;

		// 1. update references
		await ctx.models.Backglass.update({ _created_by: mergeUser._id.toString() }, { _created_by: keepUser._id.toString() });
		await ctx.models.Build.update({ _created_by: mergeUser._id.toString() }, { _created_by: keepUser._id.toString() });
		await ctx.models.Comment.update({ _from: mergeUser._id.toString() }, { _from: keepUser._id.toString() });
		await ctx.models.File.update({ _created_by: mergeUser._id.toString() }, { _created_by: keepUser._id.toString() });
		await ctx.models.Game.update({ _created_by: mergeUser._id.toString() }, { _created_by: keepUser._id.toString() });
		await ctx.models.GameRequest.update({ _created_by: mergeUser._id.toString() }, { _created_by: keepUser._id.toString() });
		await ctx.models.LogEvent.update({ _actor: mergeUser._id.toString() }, { _actor: keepUser._id.toString() });
		await ctx.models.LogEvent.update({ '_ref.user': mergeUser._id.toString() }, { '_ref.user': keepUser._id.toString() });
		await ctx.models.LogUser.update({ _user: mergeUser._id.toString() }, { _user: keepUser._id.toString() });
		await ctx.models.LogUser.update({ _actor: mergeUser._id.toString() }, { _actor: keepUser._id.toString() });
		await ctx.models.Medium.update({ _created_by: mergeUser._id.toString() }, { _created_by: keepUser._id.toString() });
		await ctx.models.Release.update({ _created_by: mergeUser._id.toString() }, { _created_by: keepUser._id.toString() });
		await ctx.models.Rom.update({ _created_by: mergeUser._id.toString() }, { _created_by: keepUser._id.toString() });
		await ctx.models.Tag.update({ _created_by: mergeUser._id.toString() }, { _created_by: keepUser._id.toString() });
		await ctx.models.Token.update({ _created_by: mergeUser._id.toString() }, { _created_by: keepUser._id.toString() });


		// const strs = ['%s backglass(es)', '%s build(s)', '%s comment(s)', '%s file(s)', '%s game(s)', '%s game request(s)',
		// 	'%s log event(s) as actor', '%s log events as ref', '%s user log(s) as user', '%s user log(s) as actor',
		// 	'%s media', '%s release(s)', '%s rom(s)', '%s tag(s)', '%s token(s).'];
		// logger.info('[model|user] Merged %s', result.map((r, i) => assign(r, { str: strs[i].replace('%s', r.n) })).filter(r => r.n > 0).map(r => r.str).join(', '));

		// 1.1 update release versions
		const releasesByAuthor = await ctx.models.Release.find({ 'authors._user': mergeUser._id.toString() }).exec();
		await Promise.all(releasesByAuthor.map((release: any) => {
			release.authors.forEach((author:ContentAuthor) => {
				if (mergeUser._id.equals(author._user)) {
					author._user = keepUser._id;
					num++;
				}
			});
			return release.save();
		}));

		// 1.2 update release validation
		const releasesByValidator = await ctx.models.Release.find({ 'versions.files.validation._validated_by': mergeUser._id.toString() }).exec();
		logger.info('[model|user] Merged %s author(s)', num);
		num = 0;
		await Promise.all(releasesByValidator.map((release: Release) => {
			release.versions.forEach(releaseVersion => {
				releaseVersion.files.forEach((releaseFile: ReleaseVersionFile) => {
					if (mergeUser._id.equals(releaseFile.validation._validated_by)) {
						releaseFile.validation._validated_by = keepUser._id;
						num++;
					}
				});
			});
			return release.save();
		}));

		const releasesByModeration = await ctx.models.Release.find({ 'moderation.history._created_by': mergeUser._id.toString() }).exec();
		logger.info('[model|user] Merged %s release moderation(s)', num);
		num = 0;
		// 1.3 release moderation
		await Promise.all(releasesByModeration.map((release: Release) => {
			release.moderation.history.forEach(historyItem => {
				if (mergeUser._id.equals(historyItem._created_by)) {
					historyItem._created_by = keepUser._id;
					num++;
				}
			});
			return release.save();
		}));

		const backglasses = await ctx.models.Backglass.find({ 'moderation.history._created_by': mergeUser._id.toString() }).exec();

		logger.info('[model|user] Merged %s item(s) in release moderation history', num);
		num = 0;

		// 1.4 backglass moderation
		await Promise.all(backglasses.map((backglass:Backglass) => {
			backglass.moderation.history.forEach(historyItem => {
				if (mergeUser._id.equals(historyItem._created_by)) {
					historyItem._created_by = keepUser._id;
					num++;
				}
			});
			return backglass.save();
		}));


		logger.info('[model|user] Merged %s item(s) in backglass moderation history', num);
		num = 0;

		// 1.5 ratings. first, update user id of all ratings
		const numRatings = await ctx.models.Rating.update({ _from: mergeUser._id.toString() }, { _from: keepUser._id.toString() });

		logger.info('[model|user] Merged %s rating(s)', numRatings.n);

		// then, remove duplicate ratings
		const ratingMap = new Map();
		const ratings = await ctx.models.Rating.find({ _from: mergeUser._id.toString() }).exec();
		// put ratings for the same thing into a map
		ratings.forEach(rating => {
			const key = keys(rating._ref).sort().join(',') + ':' + values(rating._ref).sort().join(',');
			ratingMap.set(key, (ratingMap.get(key) || []).push(rating));
		});

		// remove dupes
		queries = [];
		Array.from(ratingMap.values()).filter(ratings => ratings.length > 1).forEach(dupeRatings => {
			// update first
			const first = dupeRatings.shift();
			queries.push(first.update({ value: Math.round(sum(dupeRatings.map((r:Rating) => r.value)) / dupeRatings.length) }));
			// delete the rest
			dupeRatings.forEach((r:Rating) => queries.push(r.remove()));
		});
		await Promise.all(queries);

		// 1.6 stars: first, update user id of all stars
		const numStars = await ctx.models.Star.update({ _from: mergeUser._id.toString() }, { _from: keepUser._id.toString() });

		logger.info('[model|user] Merged %s star(s)', numStars.n);

		// then, remove duplicate stars
		const starMap = new Map();
		const stars = await ctx.models.Star.find({ _from: mergeUser._id.toString() }).exec();
		// put ratings for the same thing into a map
		stars.forEach(star => {
			const key = keys(star._ref).sort().join(',') + ':' + values(star._ref).sort().join(',');
			starMap.set(key, (starMap.get(key) || []).push(star));
		});
		// remove dupes
		queries = [];
		Array.from(starMap.values()).filter(ratings => ratings.length > 1).forEach(dupeStars => {
			// keep first
			dupeStars.shift();
			// delete the rest
			dupeStars.forEach((s:Star) => queries.push(s.remove()));
		});
		await Promise.all(queries);


		// 2. merge data
		config.vpdb.quota.plans.forEach(plan => { // we assume that in the settings, the plans are sorted by increasing value
			if ([keepUser._plan, mergeUser._plan].includes(plan.id)) {
				keepUser._plan = plan.id;
			}
		});
		keepUser.is_active = keepUser.is_active && mergeUser.is_active; // both must be active to stay active
		keepUser.emails = uniq([...keepUser.emails, ...mergeUser.emails]);
		keepUser.roles = uniq([...keepUser.roles, ...mergeUser.roles]);
		if (mergeUser.password_hash && !keepUser.password_hash) {
			keepUser.password_hash = mergeUser.password_hash;
			keepUser.password_salt = mergeUser.password_salt;
		}
		if (mergeUser.location && !keepUser.location) {
			keepUser.location = mergeUser.location;
		}
		keepUser.credits = (keepUser.credits || 0) + (mergeUser.credits || 0);
		keepUser.counter.comments = keepUser.counter.comments + mergeUser.counter.comments;
		keepUser.counter.downloads = keepUser.counter.downloads + mergeUser.counter.downloads;
		keepUser.counter.stars = keepUser.counter.stars + mergeUser.counter.stars;
		keepUser.validated_emails = uniq([...keepUser.validated_emails, ...mergeUser.validated_emails]);


		if (mergeUser.providers) {
			if (!keepUser.providers) {
				keepUser.providers = {};
			}
			keys(mergeUser.providers).forEach(k => {
				if (!keepUser.providers[k]) {
					keepUser.providers[k] = mergeUser.providers[k];
				}
			});
		}
		await keepUser.save();

		// 3. log
		//ctx.models.LogUser.success(ctx, keepUser, 'merge_users', { kept: keepUser, merged: mergeUser });

		// 4. notify
		if (explanation) {
			await userMergedDeleted(keepUser, mergeUser, explanation);
			await userMergedKept(keepUser, mergeUser, explanation);
		}

		logger.info('[model|user] Done merging, removing merged user %s.', mergeUser.id);

		// 5. delete merged user
		await mergeUser.remove();

		return keepUser;
	}
}