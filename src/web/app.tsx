import { Component } from 'react';
import { Entry, EntryList } from '../entry';
import { createRoot } from 'react-dom/client';
import { MapView } from './map';

interface AppState {
	updated?: string;
	entries?: Entry[];
	shown?: Entry[];
	done?: number;
	noPos?: number;
}

export class App extends Component<{}, AppState> {

	constructor(props: {}) {
		super(props);
		this.state = {};
	}
	
	render() {
		const { updated, shown, entries, done, noPos } = this.state;
		return <div className="app">
			<div className="info">
				<div className="counts">{shown?.length}/{entries?.length} | {noPos} без коорд. | {done} вывезли</div>
				<div className="time">{updated}</div>
			</div>
			<MapView entries={this.state.entries} shown={this.state.shown} />
		</div>;
	}
	
	componentDidMount() {
		this.reloadEntries();
		setInterval(this.reloadEntries, 20000);
	}
	
	filterEntries(all: Entry[]) {
		return all.filter(entry => entry.status != 'ВЫВЕЗЛИ' && entry.coords);
	}
	
	reloadEntries = async () => {
		const list = (await fetch('/data/entries.json').then(res => res.json())) as EntryList;
		console.log(list.entries.length);
		const { updated } = list;
		const entries = list.entries.filter(e => e.status != 'ВЫВЕЗЛИ' && e.coords);
		const done = list.entries.filter(e => e.status == 'ВЫВЕЗЛИ').length;
		const noPos = list.entries.filter(e => !e.coords).length;
		const shown = this.filterEntries(list.entries);
		this.setState({ updated, entries, done, noPos, shown });
	};
	
}

const root = createRoot(document.getElementById('ctor')!);
root.render(<App />);

