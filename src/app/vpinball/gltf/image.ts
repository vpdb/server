
//import {} from 'sharp';
import sharp = require('sharp');
import { Metadata } from 'sharp';


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

	onload: (() => void) | null;
	onerror: ((err: Error) => void) | null;

	private image: Buffer;
	private metadata: Metadata;
	private sharp: sharp.Sharp;

	constructor(buffer: Buffer) {
		this.image = buffer;
	}

	public async init(): Promise<this> {
		this.sharp = sharp(this.image);
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

	public async getImage(): Promise<Buffer> {
		return await this.sharp.toBuffer();
	}

	public hasTransparency(): boolean {
		return ['png', 'webp', 'gif'].includes(this.metadata.format);
	}
}