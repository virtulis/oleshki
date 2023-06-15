import { IconColor } from './web/markers';
import { Maybe } from './util';

export const urgentStatuses = [
	'нужна вода и еда',
	'требуется эвакуация',
	'медицина, требуются лекарства',
] as const;

export const noDataStatuses = [
	'была эвакуация, нет актуальных данных',
	'нет данных об эвакуации',
	'частично в списках эвакуированных',
] as const;

export const baseStatuses = [
	'актуально',
] as const;

export const successStatuses = ['вывезли'] as const;
export const noOpStatuses = ['решили остаться, запроса нет'] as const;

export const hiddenStatuses = [

	// temporary
	'погибшие',
	'животные',
	
	// technical
	'дубль',
	'приплюсовали',
	'пустая строка',
	
] as const;

export const defaultStatuses = [...urgentStatuses, ...baseStatuses, ...noDataStatuses] as const;
export const optionalStatuses = [...noOpStatuses, ...successStatuses] as const;

export const visibleStatuses = [...defaultStatuses, ...optionalStatuses];
export const allStatuses = [...visibleStatuses, ...hiddenStatuses];

export type VisibleStatus = (typeof visibleStatuses)[number];
export type EntryStatus = (typeof allStatuses)[number];

export const statusColors: Record<VisibleStatus, IconColor> = {
	
	'нужна вода и еда': 'red',
	'требуется эвакуация': 'red',
	'медицина, требуются лекарства': 'red',
	
	'была эвакуация, нет актуальных данных': 'violet',
	'нет данных об эвакуации': 'violet',
	актуально: 'blue',
	
	вывезли: 'green',
	'решили остаться, запроса нет': 'teal',
	
};

export type StatusCounts = Record<EntryStatus, Maybe<number>>;
