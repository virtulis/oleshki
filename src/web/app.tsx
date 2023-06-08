import { Component } from 'react';
import { Entry, EntryList } from '../entry';
import { createRoot } from 'react-dom/client';
import { MapView } from './map';

interface AppState {
	updated?: string;
	entries?: Entry[];
}

export class App extends Component<{}, AppState> {

	constructor(props: {}) {
		super(props);
		this.state = {};
	}
	
	render() {
		const { updated, entries } = this.state;
		return <div className="app">
			<div className="info">
				<div>{updated}</div>
			</div>
			<MapView entries={this.state.entries} />
		</div>;
	}
	
	componentDidMount() {
		this.reloadEntries();
	}
	
	async reloadEntries() {
		const list = (await fetch('/data/entries.json').then(res => res.json())) as EntryList;
		const { updated, entries } = list;
		this.setState({ updated, entries });
	}
	
}

const root = createRoot(document.getElementById('ctor')!);
root.render(<App />);

