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
