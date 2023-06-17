import { t } from './i18n.js';
import { defaultStatuses, EntryStatus, StatusCounts, visibleStatuses } from '../statuses.js';

export interface FilterState {
	statuses: EntryStatus[];
	lists: string[];
	animals: boolean;
}

export const defaltFilterState: FilterState = {
	statuses: [...defaultStatuses],
	lists: [],
	animals: false,
};
export const emptyFilterState: FilterState = {
	statuses: [],
	lists: [],
	animals: false,
};

export function FilterConfig({ filter, setFilter, statuses, lists }: {
	filter: FilterState;
	setFilter: (filter: FilterState) => void;
	statuses?: StatusCounts;
	lists?: string[];
}) {
	
	const check = (opt: string, dim: 'statuses' | 'lists', val: boolean) => {
		const arr = filter[dim];
		const res = val ? [...(arr ?? []), opt] : arr?.filter(e => e != opt);
		const upd = { ...filter, [dim]: res };
		setFilter(upd);
	};
	
	const showOnly = (e: React.MouseEvent, what: Partial<FilterState>) => {
		e.stopPropagation();
		e.preventDefault();
		setFilter({ ...emptyFilterState, ...what });
	};
	
	return <div className="filters">
		<div className="filter-group">
			<div className="group-heading">
				<small>{t('статус')}:</small>
				<a onClick={() => setFilter(defaltFilterState)}>⮌</a>
			</div>
			{visibleStatuses?.filter(opt => statuses?.[opt]).map(opt => <label key={opt}>
				<input
					type="checkbox"
					checked={filter.statuses.includes(opt)}
					onChange={e => check(opt, 'statuses', e.currentTarget.checked)}
				/>
				<span>{t(opt)}</span>
				<a title={t('показать только')} onClick={e => showOnly(e, { statuses: [opt] })}>○</a>
			</label>)}
		</div>
		{!!lists?.length && <div className="filter-group">
			<div className="filter-group-header">
				<small>{t('выгрузка')}:</small>
			</div>
			{lists.map(opt => <label key={opt}>
				<input
					type="checkbox"
					checked={filter.lists.includes(opt)}
					onChange={e => check(opt, 'lists', e.currentTarget.checked)}
				/>
				<span>{opt}</span>
				<a title={t('показать только')} onClick={e => showOnly(e, { lists: [opt] })}>○</a>
			</label>)}
		</div>}
		<div className="filter-group">
			<div className="filter-group-header">
				<small>{t('фильтры')}:</small>
			</div>
			<label>
				<input
					type="checkbox"
					checked={filter.animals}
					onChange={e => setFilter({ ...filter, animals: e.currentTarget.checked })}
				/>
				<span>{t('животные')}</span>
				<a title={t('показать только')} onClick={e => showOnly(e, { animals: true })}>○</a>
			</label>
		</div>
	</div>;
}
