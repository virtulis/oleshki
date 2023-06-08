import { Component, createRef } from 'react';
import L from 'leaflet';
import { Entry } from '../entry';
import { renderToString } from 'react-dom/server';

interface MapProps {
	entries?: Entry[];
	shown?: Entry[];
}
interface MapState {

}

export class MapView extends Component<MapProps, MapState> {

	div = createRef<HTMLDivElement>();
	map!: L.Map;
	
	markers = new Map<string, L.Marker>;
	
	render() {
		return <div className="map" ref={this.div} />;
	}
	
	shouldComponentUpdate(nextProps: Readonly<MapProps>, nextState: Readonly<MapState>, nextContext: any) {
		if (nextProps.shown && nextProps.shown != this.props.shown) this.updateEntries(nextProps);
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
		
		if (this.props.shown) this.updateEntries(this.props);
		
	}
	
	updateEntries({ entries, shown }: MapProps) {
		const seen = new Set<string>();
		for (const entry of shown!) {
			if (!entry.coords) continue;
			const key = JSON.stringify([entry.id, entry.urgent, entry.status, entry.coords]);
			seen.add(key);
			if (!this.markers.has(key)) {
				// console.log('add', key);
				this.markers.set(key, L.marker(entry.coords, {
					interactive: true,
				}).addTo(this.map).bindPopup(layer => renderToString(<EntryPopup entry={entry} />)));
			}
		}
		for (const [key, marker] of this.markers.entries()) {
			if (seen.has(key)) continue;
			// console.log('rm', key);
			marker.remove();
			this.markers.delete(key);
		}
	}
	
}

const dump = ['coords', 'urgent', 'status', 'certain', 'address', 'people', 'animals', 'contact', 'contactInfo', 'details'] as const;
function EntryPopup({ entry }: { entry: Entry }) {
	return <div>
		{dump.filter(k => entry[k]).map(k => <div>{k}: {String(entry[k])}</div>)}
	</div>;
}
