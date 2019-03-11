/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

import { EventEmitter } from 'events';
import { close, open, read } from 'fs';
import { find, values } from 'lodash';
import { readableStream } from './event-stream';

class Header {

	/** Size of sectors */
	public secSize: number;

	/** Number of sectors used for the Sector Allocation Table */
	public SATSize: number;

	/** Number of sectors used for the Master Sector Allocation Table */
	public MSATSize: number;

	/** Starting Sec ID of the Master Sector Allocation Table */
	public MSATSecId: number;

	/** Size of short sectors */
	public shortSecSize: number;

	/** Maximum size of a short stream */
	public shortStreamMax: number;

	/** Number of sectors used for the Short Sector Allocation Table */
	public SSATSize: number;

	/** Starting Sec ID of the Short Sector Allocation Table */
	public SSATSecId: number;

	/** Starting Sec ID of the directory stream */
	public dirSecId: number;

	public partialMSAT: number[];
	private readonly _oleId: Buffer;

	constructor() {
		this._oleId = Buffer.from('D0CF11E0A1B11AE1', 'hex');
	}

	public load(buffer: Buffer) {
		for (let i = 0; i < 8; i++) {
			if (this._oleId[i] !== buffer[i]) {
				return false;
			}
		}
		this.secSize = 1 << buffer.readInt16LE(30);
		this.shortSecSize = 1 << buffer.readInt16LE(32);
		this.SATSize = buffer.readInt32LE(44);
		this.dirSecId = buffer.readInt32LE(48);
		this.shortStreamMax = buffer.readInt32LE(56);
		this.SSATSecId = buffer.readInt32LE(60);
		this.SSATSize = buffer.readInt32LE(64);
		this.MSATSecId = buffer.readInt32LE(68);
		this.MSATSize = buffer.readInt32LE(72);

		// The first 109 sectors of the MSAT
		this.partialMSAT = new Array(109);
		for (let i = 0; i < 109; i++) {
			this.partialMSAT[i] = buffer.readInt32LE(76 + i * 4);
		}
		return true;
	}
}

class AllocationTable {

	private static SecIdFree = -1;
	private static SecIdEndOfChain = -2;
	private static SecIdSAT = -3;
	private static SecIdMSAT = -4;

	private readonly doc: OleCompoundDoc;
	private table: number[];

	constructor(doc: OleCompoundDoc) {
		this.doc = doc;
	}

	public async load(secIds: number[]) {
		const header = this.doc.header;
		this.table = new Array(secIds.length * (header.secSize / 4));
		const buffer = await this.doc.readSectors(secIds);
		for (let i = 0; i < buffer.length / 4; i++) {
			this.table[i] = buffer.readInt32LE(i * 4);
		}
	}

	public getSecIdChain(startSecId: number): number[] {
		let secId = startSecId;
		const secIds: number[] = [];
		while (secId !== AllocationTable.SecIdEndOfChain) {
			secIds.push(secId);
			secId = this.table[secId];
			if (!secId) {
				throw new Error('Possibly corrupt file (cannot find secId ' + secIds[secIds.length - 1] + ' in allocation table).');
			}
		}
		return secIds;
	}
}

interface StorageEntry {
	name: string;
	type: number;
	nodeColor: number;
	left: number;
	right: number;
	storageDirId: number;
	secId: number;
	size: number;
	storages?: { [key: string]: StorageEntry };
	streams?: { [key: string]: StorageEntry };
}

class DirectoryTree {

	private static EntryTypeEmpty = 0;
	private static EntryTypeStorage = 1;
	private static EntryTypeStream = 2;
	private static EntryTypeRoot = 5;

	private static NodeColorRed = 0;
	private static NodeColorBlack = 1;

	private static Leaf = -1;
	public root: StorageEntry;

	private readonly doc: OleCompoundDoc;
	private entries: StorageEntry[];

	constructor(doc: OleCompoundDoc) {
		this.doc = doc;
	}

	public async load(secIds: number[]): Promise<void> {
		const buffer = await this.doc.readSectors(secIds);
		const count = buffer.length / 128;
		this.entries = new Array(count);
		for (let i = 0; i < count; i++) {
			const offset = i * 128;
			const nameLength = Math.max(buffer.readInt16LE(64 + offset) - 1, 0);
			this.entries[i] = {
				name: buffer.toString('utf16le', offset, nameLength + offset),
				type: buffer.readInt8(66 + offset),
				nodeColor: buffer.readInt8(67 + offset),
				left: buffer.readInt32LE(68 + offset),
				right: buffer.readInt32LE(72 + offset),
				storageDirId: buffer.readInt32LE(76 + offset),
				secId: buffer.readInt32LE(116 + offset),
				size: buffer.readInt32LE(120 + offset),
			};
		}
		this.root = find<StorageEntry>(this.entries, entry => entry.type === DirectoryTree.EntryTypeRoot);
		this._buildHierarchy(this.root);
	}

	private _buildHierarchy(storageEntry: StorageEntry) {
		const childIds = this._getChildIds(storageEntry);

		storageEntry.storages = {};
		storageEntry.streams = {};

		for (const childId of childIds) {
			const childEntry = this.entries[childId];
			const name = childEntry.name;
			if (childEntry.type === DirectoryTree.EntryTypeStorage) {
				storageEntry.storages[name] = childEntry;
			}
			if (childEntry.type === DirectoryTree.EntryTypeStream) {
				storageEntry.streams[name] = childEntry;
			}
		}

		for (const childStorageEntry of values(storageEntry.storages)) {
			this._buildHierarchy(childStorageEntry);
		}
	}

	private _getChildIds(storageEntry: StorageEntry) {
		const childIds = [];
		if (storageEntry.storageDirId > -1) {
			childIds.push(storageEntry.storageDirId);
			const rootChildEntry = this.entries[storageEntry.storageDirId];
			return this._visit(rootChildEntry, childIds);
		}
		return [];
	}

	private _visit(visitEntry: StorageEntry, childIds: number[] = []): number[] {
		if (visitEntry.left !== DirectoryTree.Leaf) {
			childIds.push(visitEntry.left);
			childIds = this._visit(this.entries[visitEntry.left], childIds);
		}
		if (visitEntry.right !== DirectoryTree.Leaf) {
			childIds.push(visitEntry.right);
			childIds = this._visit(this.entries[visitEntry.right], childIds);
		}
		return childIds;
	}
}

export class Storage {

	private readonly doc: OleCompoundDoc;
	private dirEntry: StorageEntry;

	constructor(doc: OleCompoundDoc, dirEntry: StorageEntry) {
		this.doc = doc;
		this.dirEntry = dirEntry;
	}

	public storage(storageName: string) {
		return new Storage(this.doc, this.dirEntry.storages[storageName]);
	}

	public stream(streamName: string) {
		const streamEntry = this.dirEntry.streams[streamName];
		if (!streamEntry) {
			return null;
		}

		let bytes = streamEntry.size;

		let allocationTable = this.doc.SAT;
		let shortStream = false;
		if (bytes < this.doc.header.shortStreamMax) {
			shortStream = true;
			allocationTable = this.doc.SSAT;
		}

		const secIds = allocationTable.getSecIdChain(streamEntry.secId);

		return readableStream(async (stream, i): Promise<Buffer> => {

			if (i >= secIds.length) {
				stream.emit('end');
				return Promise.resolve(null);
			}

			let buffer: Buffer;
			if (shortStream) {
				buffer = await this.doc.readShortSector(secIds[i]);
			} else {
				buffer = await this.doc.readSector(secIds[i]);
			}
			if (bytes - buffer.length < 0) {
				buffer = buffer.slice(0, bytes);
			}
			bytes -= buffer.length;
			return buffer;
		});
	}

	/**
	 * Reads a given stream from a given storage.
	 *
	 * @param {string} key Key within the storage
	 * @return {Promise<Buffer>} Read data
	 */
	public async read(key: string): Promise<Buffer> {
		return new Promise<Buffer>((resolve, reject) => {
			const strm = this.stream(key);
			const bufs: Buffer[] = [];
			if (!strm) {
				return reject(new Error('No such stream "' + key + '".'));
			}
			strm.on('error', reject);
			strm.on('data', (buf: Buffer) => bufs.push(buf));
			strm.on('end', () => {
				resolve(Buffer.concat(bufs));
			});
		});
	}
}

export class OleCompoundDoc extends EventEmitter {

	public header: Header;
	public SAT: AllocationTable;
	public SSAT: AllocationTable;

	private readonly  filename: string;
	private fd: number;
	private skipBytes: number;
	private rootStorage: Storage;
	private MSAT: number[];
	private shortStreamSecIds: number[];
	private directoryTree: DirectoryTree;

	constructor(filename: string) {
		super();

		this.filename = filename;
		this.skipBytes = 0;
	}

	public storage(storageName: string) {
		this._assertLoaded();
		return this.rootStorage.storage(storageName);
	}

	public stream(streamName: string) {
		this._assertLoaded();
		return this.rootStorage.stream(streamName);
	}

	public async read(): Promise<void> {
		await this._openFile();
		await this._readHeader();
		await this._readMSAT();
		await this._readSAT();
		await this._readSSAT();
		await this._readDirectoryTree();
	}

	public async readWithCustomHeader(size: number): Promise<Buffer> {
		this.skipBytes = size;
		await this._openFile();
		const buffer = await this._readCustomHeader();
		await this._readHeader();
		await this._readMSAT();
		await this._readSAT();
		await this._readSSAT();
		await this._readDirectoryTree();

		return buffer;
	}

	public async readSector(secId: number) {
		this._assertLoaded();
		return this.readSectors([secId]);
	}

	public async readSectors(secIds: number[]): Promise<Buffer> {
		this._assertLoaded();
		const buffer = Buffer.alloc(secIds.length * this.header.secSize);
		let i = 0;
		while (i < secIds.length) {
			const bufferOffset = i * this.header.secSize;
			const fileOffset = this._getFileOffsetForSec(secIds[i]);
			await readAsync(this.fd, buffer, bufferOffset, this.header.secSize, fileOffset);
			i++;
		}
		return buffer;
	}

	public async readShortSector(secId: number): Promise<Buffer> {
		this._assertLoaded();
		return this._readShortSectors([secId]);
	}

	public async close(): Promise<void> {
		if (this.fd) {
			await closeAsync(this.fd);
		}
		this.fd = null;
	}

	private _assertLoaded() {
		if (!this.fd) {
			throw new Error('Document must be loaded first.');
		}
	}

	private async _readShortSectors(secIds: number[]): Promise<Buffer> {
		const buffer = Buffer.alloc(secIds.length * this.header.shortSecSize);
		let i = 0;
		while (i < secIds.length) {
			const bufferOffset = i * this.header.shortSecSize;
			const fileOffset = this._getFileOffsetForShortSec(secIds[i]);
			await readAsync(this.fd, buffer, bufferOffset, this.header.shortSecSize, fileOffset);
			i++;
		}
		return buffer;
	}

	private async _openFile(): Promise<void> {
		this.fd = await openAsync(this.filename, 'r', 0o666);
	}

	private async _readCustomHeader(): Promise<Buffer> {
		const buffer = Buffer.alloc(this.skipBytes);
		let bytesRead: number;
		let data: Buffer;
		[bytesRead, data] = await readAsync(this.fd, buffer, 0, this.skipBytes, 0);
		return data;
	}

	private async _readHeader(): Promise<void> {
		const buffer = Buffer.alloc(512);
		let bytesRead: number;
		let data: Buffer;
		[bytesRead, data] = await readAsync(this.fd, buffer, 0, 512, this.skipBytes);
		const header = this.header = new Header();
		if (!header.load(data)) {
			throw new Error('Not a valid compound document.');
		}
	}

	private async _readMSAT(): Promise<void> {

		this.MSAT = this.header.partialMSAT.slice(0);
		this.MSAT.length = this.header.SATSize;

		if (this.header.SATSize <= 109 || this.header.MSATSize === 0) {
			return;
		}

		let secId = this.header.MSATSecId;
		let currMSATIndex = 109;
		let i = 0;
		while (i < this.header.MSATSize) {
			const sectorBuffer = await this.readSector(secId);
			for (let s = 0; s < this.header.secSize - 4; s += 4) {
				if (currMSATIndex >= this.header.SATSize) {
					break;
				} else {
					this.MSAT[currMSATIndex] = sectorBuffer.readInt32LE(s);
				}
				currMSATIndex++;
			}
			secId = sectorBuffer.readInt32LE(this.header.secSize - 4);
			i++;
		}
	}

	private async _readSAT(): Promise<void> {
		this.SAT = new AllocationTable(this);
		await this.SAT.load(this.MSAT);
	}

	private async _readSSAT(): Promise<void> {
		this.SSAT = new AllocationTable(this);
		const secIds = this.SAT.getSecIdChain(this.header.SSATSecId);
		if (secIds.length !== this.header.SSATSize) {
			throw new Error('Invalid Short Sector Allocation Table');
		}
		await this.SSAT.load(secIds);
	}

	private async _readDirectoryTree(): Promise<void> {
		this.directoryTree = new DirectoryTree(this);

		const secIds = this.SAT.getSecIdChain(this.header.dirSecId);
		await this.directoryTree.load(secIds);

		const rootEntry = this.directoryTree.root;
		this.rootStorage = new Storage(this, rootEntry);
		this.shortStreamSecIds = this.SAT.getSecIdChain(rootEntry.secId);
	}

	private _getFileOffsetForSec(secId: number): number {
		const secSize = this.header.secSize;
		return this.skipBytes + (secId + 1) * secSize;  // Skip past the header sector
	}

	private _getFileOffsetForShortSec(shortSecId: number): number {
		const shortSecSize = this.header.shortSecSize;
		const shortStreamOffset = shortSecId * shortSecSize;
		const secSize = this.header.secSize;
		const secIdIndex = Math.floor(shortStreamOffset / secSize);
		const secOffset = shortStreamOffset % secSize;
		const secId = this.shortStreamSecIds[secIdIndex];
		return this._getFileOffsetForSec(secId) + secOffset;
	}
}

async function openAsync(path: string, flags?: string | number, mode: number = 0o666): Promise<number> {
	return new Promise((resolve, reject) => {
		open(path, flags, mode, (err, fd) => {
			if (err) {
				reject(err);
				return;
			}
			resolve(fd);
		});
	});
}

async function closeAsync(fd: number): Promise<void> {
	return new Promise((resolve, reject) => {
		close(fd, err => {
			if (err) {
				reject(err);
				return;
			}
			resolve();
		});
	});
}
async function readAsync(fd: number, buffer: Buffer, offset: number, length: number, position: number): Promise<[ number, Buffer ]> {
	return new Promise((resolve, reject) => {
		read(fd, buffer, offset, length, position, (err, bytesRead, data) => {
			if (err) {
				reject(err);
				return;
			}
			resolve([bytesRead, data]);
		});
	});
}
