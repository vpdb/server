import sharp = require('sharp');
import { Metadata } from 'sharp';

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

	public onload: (() => void) | null;
	public onerror: ((err: Error) => void) | null;

	private readonly sharp: sharp.Sharp;
	private readonly optimize: boolean;

	private metadata: Metadata;

	constructor(data: Buffer | sharp.Sharp, optimize: boolean) {
		this.optimize = optimize;
		if (data instanceof Buffer) {
			this.sharp = sharp(data);

		} else {
			this.sharp = data;
		}
	}

	public async init(): Promise<this> {
		const metadata = await this.sharp.metadata();
		this.width = metadata.width;
		this.naturalWidth = metadata.width;
		this.height = metadata.height;
		this.naturalHeight = metadata.height;
		this.metadata = metadata;
		this.complete = true;
		if (this.onload) {
			this.onload();
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
		return this.metadata.format;
	}

	public async getImage(): Promise<Buffer> {
		switch (this.metadata.format) {

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

			case 'jpeg': {
				return this.sharp.jpeg({ quality: 70 }).toBuffer();
			}

			default:
				return this.sharp.toBuffer();
		}
	}

	public hasTransparency(): boolean {
		return ['png', 'webp', 'gif'].includes(this.metadata.format);
	}
}
