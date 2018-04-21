import { Document, Schema } from 'mongoose';
import { User } from '../users/user.type';

export interface File extends Document {
	id: string
	name: string
	bytes: number
	mime_type: string, // todo add enum
	file_type: string, // todo add enum
	metadata: any
	variations: { [key: string]: any },  // todo type
	preprocessed: any, // todo wtf is that
	is_active: boolean
	counter: { downloads: number },
	created_at: Date
	_created_by: User | Schema.Types.ObjectId
}