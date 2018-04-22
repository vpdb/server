import { Document, Types } from 'mongoose';
import { User } from './user.type';

export interface ContentAuthor extends Document {
	_user: User | Types.ObjectId,
	roles: string[]
}