import { EntryStatus } from './statuses';
import { Maybe } from './util.js';

export interface Entry {
	id: string;
	idx: number;
	coords?: [number, number];
	medical?: boolean;
	status: EntryStatus;
	address?: string;
	addressRu?: string;
	city?: string;
	details?: string;
	publicDetails?: string;
	people?: string;
	contact?: string;
	contactInfo?: string;
	animals?: string;
	list?: string;
	data?: Record<string, string>;
}

export interface EntryList {
	updated: string;
	done: number;
	entries: Entry[];
	columns: string[];
	mapping: Partial<Record<keyof Entry, Maybe<number>>>;
}

export interface DiffEntry {
	id: string;
	data: Partial<Record<keyof Entry, any>>;
	lastChange: Maybe<string>;
	changed: Partial<Record<keyof Entry, string>>;
	previous: Partial<Record<keyof Entry, any>>;
	first: Partial<Record<keyof Entry, any>>;
}

export const significantEntryFields: (keyof Entry)[] = [
	'id',
	// 'idx',
	'coords',
	'medical',
	'status',
	'address',
	'addressRu',
	'details',
	// 'publicDetails',
	'people',
	'contact',
	'contactInfo',
	'animals',
	// 'data',
];
