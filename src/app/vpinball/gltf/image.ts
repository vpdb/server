import gm, { State } from 'gm';
import sharp = require('sharp');
import { logger } from '../../common/logger';

const PngQuant = require('pngquant');
const OptiPng = require('optipng');

export class Image {

	public readonly src: string;
	public height: number;
	public width: number;
	private format: string;

	private sharp: sharp.Sharp;
	private data: Buffer;
	private readonly optimize: boolean;

	private gm: State;

	constructor(src: string, data: Buffer | sharp.Sharp, optimize: boolean) {
		this.src = src;
		this.optimize = optimize;
		if (data instanceof Buffer) {
			this.sharp = sharp(data);
			this.data = data;

		} else {
			this.sharp = data;
		}
	}

	public async init(): Promise<this> {
		try {
			const metadata = await this.sharp.metadata();
			this.width = metadata.width;
			this.height = metadata.height;
			this.format = metadata.format;
		} catch (err) {
			logger.warn(null, '[Image.init] Could not read metadata from buffer (%s), using GM to read image.', err.message);
			this.gm = gm(this.data);
			const metadata = await this.gmIdentify();
			this.format = metadata.format.toLowerCase();
			this.width = metadata.size.width;
			this.height = metadata.size.height;
			const data = await new Promise((resolve, reject) => {
				const buffers: Buffer[] = [];
				this.gm.setFormat('jpeg').stream().on('error', reject)
					.on('data', (buf: Buffer) => buffers.push(buf as Buffer))
					.on('end', () => resolve(Buffer.concat(buffers)))
					.on('error', reject);
			});
			this.data = undefined;
			this.sharp = sharp(data);
		}
		return this;
	}

	public resize(width: number, height: number): this {
		this.sharp.resize(width, height, { fit: 'fill' });
		this.width = width;
		this.height = height;
		return this;
	}

	public flipY(): this {
		this.sharp.flip();
		return this;
	}

	public getFormat(): string {
		return this.format;
	}

	public async getImage(): Promise<Buffer> {

		switch (this.format) {

			case 'png': {
				if (this.optimize) {
					const quanter = new PngQuant([128]);
					const optimizer = new OptiPng(['-o7']);
					return new Promise((resolve, reject) => {
						const buffers: Buffer[] = [];
						this.sharp.on('error', reject)
							.pipe(quanter).on('error', reject)
							.pipe(optimizer).on('error', reject)
							.on('data', (buf: Buffer) => buffers.push(buf as Buffer))
							.on('end', () => resolve(Buffer.concat(buffers)))
							.on('error', reject);
					});
				}
				return this.sharp.toBuffer();
			}

			default: {
				return this.sharp.jpeg({ quality: 70 }).toBuffer();
			}
		}
	}

	public hasTransparency(): boolean {
		return ['png', 'webp', 'gif'].includes(this.format);
	}

	private async gmIdentify(): Promise<any> {
		return new Promise((resolve, reject) => {
			this.gm.identify((err, value) => {
				if (err) {
					return reject(err);
				}
				resolve(value);
			});
		});
	}
}
