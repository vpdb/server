import { isUndefined } from 'util';
import { ApiError } from '../common/api.error';
import { SerializerOptions } from '../common/serializer';
import { state } from '../state';
import { UserDocument } from '../users/user.document';
import { flavors } from './release.flavors';

export class ReleaseListQueryBuilder {

	private readonly query: any[] = [];
	private readonly serializerOpts: SerializerOptions = {};

	public getQuery(): any[] {
		return this.query;
	}
	public getSerializerOpts(): SerializerOptions {
		return this.serializerOpts;
	}

	public filterByTag(tags: string): void {
		if (tags) {
			// all tags must be matched
			for (const tag of tags.split(',')) {
				this.query.push({ _tags: { $in: [tag] } });
			}
		}
	}

	public filterByReleaseIds(ids: string): void {
		if (ids) {
			this.query.push({ id: { $in: ids.split(',') } });
		}
	}

	public filterByValidationStatus(validation: string): void {
		const validationStatusValues = ['verified', 'playable', 'broken'];
		if (!isUndefined(validation)) {
			if (validationStatusValues.includes(validation)) {
				this.query.push({ 'versions.files.validation.status': validation });
			}
			if (validation === 'none') {
				this.query.push({ 'versions.files.validation': { $exists: false } });
			}
		}
	}
	public filterByFlavor(flavor: string): void {
		if (!isUndefined(flavor)) {
			flavor.split(',').forEach((f: string) => {
				const [key, val] = f.split(':');
				if (flavors.values[key]) {
					this.query.push({ ['versions.files.flavor.' + key]: { $in: ['any', val] } });
				}
			});
			// also return the same thumb if not specified otherwise.
			this.serializerOpts.thumbFlavor = flavor;
		}
	}

	public async filterByQuery(searchQuery: string): Promise<void> {
		if (searchQuery) {
			if (searchQuery.trim().length < 3) {
				throw new ApiError('Query must contain at least two characters.').status(400);
			}
			// sanitize and build regex
			const titleQuery = searchQuery.trim().replace(/[^a-z0-9-]+/gi, '');
			const titleRegex = new RegExp(titleQuery.split('').join('.*?'), 'i');
			const idQuery = searchQuery.trim().replace(/[^a-z0-9-]+/gi, ''); // TODO tune
			const games = await state.models.Game.find({
				'counter.releases': { $gt: 0 },
				$or: [{ title: titleRegex }, { id: idQuery }],
			}, '_id').exec();
			const gameIds = games.map(g => g._id);
			if (gameIds.length > 0) {
				this.query.push({ $or: [{ name: titleRegex }, { _game: { $in: gameIds } }] });
			} else {
				this.query.push({ name: titleRegex });
			}
		}
	}
	public async filterByProviderUser(providerUserId: string, tokenType: string, tokenProvider: string): Promise<void> {
		if (providerUserId) {
			if (tokenType !== 'provider') {
				throw new ApiError('Must be authenticated with provider token in order to filter by provider user ID.').status(400);
			}
			const user = await state.models.User.findOne({ ['providers.' + tokenProvider + '.id']: String(providerUserId) });
			if (user) {
				this.query.push({ 'authors._user': user._id.toString() });
			}
		}
	}

	public async filterByStarred(starred: string, user: UserDocument, starredReleaseIds: string[]): Promise<void> {
		if (!isUndefined(starred)) {
			if (!user) {
				throw new ApiError('Must be logged when listing starred releases.').status(401);
			}
			if (starred === 'false') {
				this.query.push({ _id: { $nin: starredReleaseIds } });
			} else {
				this.query.push({ _id: { $in: starredReleaseIds } });
			}
		}
	}

	public async filterByCompatibility(buildIds: string): Promise<void> {
		if (!isUndefined(buildIds)) {
			const builds = await state.models.Build.find({ id: { $in: buildIds.split(',') } }).exec();
			this.query.push({ 'versions.files._compatibility': { $in: builds.map(b => b._id) } });
		}
	}

	public async filterByFileSize(fileSize: number, threshold: number = 0): Promise<void> {
		if (fileSize) {
			const q: any = { file_type: 'release' };
			if (threshold && !isNaN(threshold)) {
				q.bytes = { $gt: fileSize - threshold, $lt: fileSize + threshold };
			} else {
				q.bytes = fileSize;
			}
			const files = await state.models.File.find(q).exec();
			if (files && files.length > 0) {
				this.serializerOpts.fileIds = files.map(f => f.id);
				this.query.push({ 'versions.files._file': { $in: files.map(f => f._id) } });
			} else {
				this.query.push({ _id: null }); // no result
			}
		}
	}
}
