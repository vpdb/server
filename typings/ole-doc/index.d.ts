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

// Type definitions for ole-doc
// Project: https://github.com/atariman486/node-ole-doc
// Definitions by: freezy <https://github.com/freezy>

/// <reference types="node" />

declare module 'ole-doc' {

	import * as Stream from 'stream';

	interface Header {
		ole_id: Buffer;

		load(buffer: Buffer): boolean;
	}

	interface AllocationTable {

		constructor(doc: OleCompoundDoc): AllocationTable;

		load(secIds: number[], callback: () => void): void;

		getSecIdChain(startSecId: number): number[];
	}

	interface DirectoryTree {

		constructor(doc: OleCompoundDoc): DirectoryTree;

		load(secIds: number[], callback: () => void): void;
	}

	interface Storage {
		constructor(doc: OleCompoundDoc, dirEntry: StorageEntry): Storage;

		storage(storageName: string): Storage;

		stream(streamName: string): Stream;
	}

	//new
	interface StorageEntry {
		storages: { [key: string]: ChildEntry };
		streams: { [key: string]: ChildEntry };
	}

	interface ChildEntry {
		name: string;
		type: number;
		nodeColor: number;
		left: number;
		right: number;
		storageDirId: number;
		secId: number;
		size: number;
	}

	export interface OleCompoundDoc {
		constructor(filename: string): OleCompoundDoc;

		read(): void;

		readWithCustomHeader(size: number, callback: (buf: Buffer) => boolean): void;

		storage(storageName: string): Storage;

		stream(streamName: string): Stream;
	}
}
