import { Document } from 'mongoose';
import { ReleaseVersionFile } from './release.version.file.type';

export interface ReleaseVersion extends Document {
	version: string,
	released_at: Date,
	changes: string,
	files: ReleaseVersionFile[],
	counter: {
		downloads: number,
		comments: number
	}
}