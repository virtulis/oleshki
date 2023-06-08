export interface Entry {
	idx: number;
	coords?: [number, number];
	certain: boolean;
	tag?: string;
	status?: string;
	address?: string;
	details?: string;
	people?: string;
	contact?: string;
	animals?: string;
	data: Record<string, string>;
}

export interface EntryList {
	updated: string;
	entries: Entry[];
}
