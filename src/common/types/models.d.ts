import { Model } from 'mongoose';
import { File } from '../../files/file.type';
import { User } from '../../users/user.type';
import { Release } from '../../releases/release.type';

export interface Models {
	Backglass: Model;
	Build: Model;
	Comment: Model;
	File: Model<File>;
	Game: Model;
	GameRequest: Model;
	LogEvent: Model;
	LogUser: Model;
	Medium: Model;
	Rating: Model;
	Release: Model<Release>;
	Rom: Model;
	Tag: Model;
	Token: Model;
	Star: Model;
	User: Model<User>;
}