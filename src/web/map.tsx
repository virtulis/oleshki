import { Component, createRef } from 'react';
import L from 'leaflet';
import { Entry } from '../entry';
import { renderToString } from 'react-dom/server';

interface MapProps {
	entries?: Entry[];
}
interface MapState {

}

export class MapView extends Component<MapProps, MapState> {

	div = createRef<HTMLDivElement>();
	map!: L.Map;
	
	render() {
		return <div className="map" ref={this.div} />;
	}
	
	shouldComponentUpdate(nextProps: Readonly<MapProps>, nextState: Readonly<MapState>, nextContext: any) {
		if (nextProps.entries && nextProps.entries != this.props.entries) this.updateEntries(nextProps.entries);
		return false;
	}
	
	componentDidMount() {
	
		this.map = L.map(this.div.current!).setView([46.61549, 32.69943], 11);
		const osm = L.tileLayer('/osm/{z}/{x}/{y}.png', {
			maxZoom: 19,
			attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
		}).addTo(this.map);
		const visicom = new L.TileLayer('/visicom/2.0.0/planet3/base/{z}/{x}/{y}.png', {
			attribution: '<a href=\'https://api.visicom.ua/\'>Визиком</a>',
			// subdomains: '123',
			maxZoom: 19,
			tms: true,
		}).addTo(this.map);
		L.control.layers({
			OSM: osm,
			Visicom: visicom,
		}).addTo(this.map);
		
		if (this.props.entries) this.updateEntries(this.props.entries);
		
	}
	
	updateEntries(entries: Entry[]) {
		for (const entry of entries) {
			if (!entry.coords) continue;
			L.marker(entry.coords, {
				interactive: true,
			}).addTo(this.map).bindPopup(layer => renderToString(<EntryPopup entry={entry} />));
		}
	}
	
}

const dump = ['coords', 'certain', 'address', 'people', 'contact', 'animals', 'details', 'status', 'tag'] as const;
function EntryPopup({ entry }: { entry: Entry }) {
	return <div>
		{dump.filter(k => entry[k]).map(k => <div>{k}: {String(entry[k])}</div>)}
	</div>;
}
