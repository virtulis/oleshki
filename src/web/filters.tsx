import { t } from './i18n.js';
import { defaultStatuses, EntryStatus, optionalStatuses, StatusCounts } from '../statuses.js';
import { Maybe } from '../util.js';

export interface FilterState {
	only?: EntryStatus[];
	also?: EntryStatus[];
	lists?: string[];
	animals?: boolean;
}

export function FilterConfig({ filter, setFilter, statuses, lists }: {
	filter: Maybe<FilterState>;
	setFilter: (filter: FilterState) => void;
	statuses?: StatusCounts;
	lists?: string[];
}) {
	
	const check = (opt: string, dim: 'only' | 'also' | 'lists', val: boolean) => {
		const arr = filter?.[dim];
		const res = val ? [...(arr ?? []), opt] : arr?.filter(e => e != opt);
		const upd = { ...filter, [dim]: res?.length ? res : undefined };
		setFilter(upd);
	};
	
	return <div className="filters">
		<div className="filter-group">
			<small>{t('показать только')}:</small>
			{defaultStatuses?.filter(opt => statuses?.[opt]).map(opt => <label key={opt}>
				<input
					type="checkbox"
					checked={!!filter?.only?.includes(opt)}
					onChange={e => check(opt, 'only', e.currentTarget.checked)}
				/>
				<span>{t(opt)}</span>
			</label>)}
		</div>
		<div className="filter-group">
			<small>{t('показать также')}:</small>
			{optionalStatuses?.filter(opt => statuses?.[opt]).map(opt => <label key={opt}>
				<input
					type="checkbox"
					checked={!!filter?.also?.includes(opt)}
					onChange={e => check(opt, 'also', e.currentTarget.checked)}
				/>
				<span>{t(opt)}</span>
			</label>)}
		</div>
		{!!lists?.length && <div className="filter-group">
			<small>{t('выгрузка')}:</small>
			{lists.map(opt => <label key={opt}>
				<input
					type="checkbox"
					checked={!!filter?.lists?.includes(opt)}
					onChange={e => check(opt, 'lists', e.currentTarget.checked)}
				/>
				<span>{opt}</span>
			</label>)}
		</div>}
		<div className="filter-group">
			<small>{t('фильтры')}:</small>
			<label>
				<input
					type="checkbox"
					checked={!!filter?.animals}
					onChange={e => setFilter({ ...filter, animals: e.currentTarget.checked })}
				/>
				<span>{t('животные')}</span>
			</label>
		</div>
	</div>;
}
