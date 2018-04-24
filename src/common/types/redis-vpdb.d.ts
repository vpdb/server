import { Callback, Commands } from 'redis';
import { EventEmitter } from 'events';

declare module 'redis' {
	interface RedisClient extends Commands<boolean>, EventEmitter {
		setAsync(key: string, value: string): Promise<void>;

		getAsync(key: string): Promise<string>;

		ttlAsync(key: string): Promise<number>;

		incrAsync(key: string): Promise<number>;

		expireAsync(key: string, seconds: number): Promise<number>;
	}
}

