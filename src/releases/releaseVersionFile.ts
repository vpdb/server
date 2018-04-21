import { Document, Schema } from 'mongoose';
import { File } from '../files/file.type';
import { User } from '../users/user.type';

export interface ReleaseVersionFile extends Document {
	_file: File | Schema.Types.ObjectId,
	flavor: {
		orientation: string, // todo type
		lighting: string, // todo type
	},
	validation: {
		status: string, // todo type
		message: string
		validated_at: Date,
		_validated_by: User | Schema.Types.ObjectId,
	},
	_compatibility: any, // todo Build[]
	_playfield_image: File | Schema.Types.ObjectId
	_playfield_video: File | Schema.Types.ObjectId
	released_at: Date,
	counter: {
		downloads: number
	}
}