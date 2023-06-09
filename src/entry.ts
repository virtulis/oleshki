export interface Entry {
	id: string;
	idx: number;
	coords?: [number, number];
	certain: boolean;
	remain?: boolean;
	medical?: boolean;
	urgent?: string;
	status?: string;
	address?: string;
	addressRu?: string;
	city?: string;
	details?: string;
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
	columns?: string[];
	mapping?: Record<string, number>;
}
