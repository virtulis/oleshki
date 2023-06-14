import { EntryStatus } from './statuses';
import { Maybe } from './util.js';

export interface Entry {
	id: string;
	idx: number;
	coords?: [number, number];
	uncertain: boolean;
	remain?: boolean;
	rescued?: boolean;
	medical?: boolean;
	urgent?: string;
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
	data?: Record<string, string>;
}

export interface EntryList {
	updated: string;
	done: number;
	entries: Entry[];
	columns: string[];
	mapping: Partial<Record<keyof Entry, Maybe<number>>>;
}
