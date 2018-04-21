import { Document, Schema } from 'mongoose';
import { User } from '../users/user.type';

export interface ReleaseAuthor extends Document {
	_user: User | Schema.Types.ObjectId,
	roles: string[]
}