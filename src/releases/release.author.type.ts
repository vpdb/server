import { Document, Types } from 'mongoose';
import { User } from '../users/user.type';

export interface ReleaseAuthor extends Document {
	_user: User | Types.ObjectId,
	roles: string[]
}