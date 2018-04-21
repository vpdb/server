import { Model } from 'mongoose';
import { Backglass } from '../../backglasses/backglass.type';
import { Build } from '../../builds/build.type';
import { Comment } from '../../comments/comment.type';
import { File } from '../../files/file.type';
import { Game } from '../../games/game.type';
import { GameRequest } from '../../game-requests/game.request.type';
import { LogEvent } from '../../log-event/log.event.type';
import { LogUser } from '../../log-user/log.user.type';
import { Medium } from '../../media/medium.type';
import { Rating } from '../../ratings/rating.type';
import { Release } from '../../releases/release.type';
import { Rom } from '../../roms/rom.type';
import { Tag } from '../../tags/tag.type';
import { Token } from '../../tokens/token.type';
import { Star } from '../../stars/star.type';
import { User } from '../../users/user.type';

export interface Models {
	Backglass: Model<Backglass>;
	Build: Model<Build>;
	Comment: Model<Comment>;
	File: Model<File>;
	Game: Model<Game>;
	GameRequest: Model<GameRequest>;
	LogEvent: Model<LogEvent>;
	LogUser: Model<LogUser>;
	Medium: Model<Medium>;
	Rating: Model<Rating>;
	Release: Model<Release>;
	Rom: Model<Rom>;
	Tag: Model<Tag>;
	Token: Model<Token>;
	Star: Model<Star>;
	User: Model<User>;
}