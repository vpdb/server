import gm, { State } from 'gm';
import sharp = require('sharp');
import { logger } from '../../common/logger';

const PngQuant = require('pngquant');
const OptiPng = require('optipng');

export class Image {

	/**
	 * The URL, `data:` URI or local file path of the image to be loaded, or a
	 * Buffer instance containing an encoded image.
	 */
	public src: Buffer;
	/** Retrieves whether the object is fully loaded. */
	public complete: boolean;
	/** Sets or retrieves the height of the image. */
	public height: number;
	/** Sets or retrieves the width of the image. */
	public width: number;

	/** The original height of the image resource before sizing. */
	public naturalHeight: number;
	/** The original width of the image resource before sizing. */
	public naturalWidth: number;

	private format: string;

	public onload: (() => void) | null;
	public onerror: ((err: Error) => void) | null;

	private sharp: sharp.Sharp;
	private readonly data: Buffer;
	private readonly optimize: boolean;

	private gm: State;

	constructor(data: Buffer | sharp.Sharp, optimize: boolean) {
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
			this.complete = true;
			if (this.onload) {
				this.onload();
			}
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
			this.sharp = sharp(data);
		}
		this.naturalWidth = this.width;
		this.naturalHeight = this.height;
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
