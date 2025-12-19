import { Component, AfterViewInit, inject, CUSTOM_ELEMENTS_SCHEMA, NgZone, provideAppInitializer} from '@angular/core';
import { PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { CdkDragEnd, DragDropModule } from '@angular/cdk/drag-drop';
import { moveItemInArray } from '@angular/cdk/drag-drop';

//All entries needed to describe a marker
type MarkerEntry = {
  marker: mapboxgl.Marker; 
  editable: boolean;
  name: string;
  id: number;
};

@Component({
  standalone: true,
  selector: 'app-map-component',
  imports: [DragDropModule, CommonModule],
  templateUrl: './map-component.html',
  styleUrl: './map-component.sass',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})


export class MapComponent {
  private platformID = inject(PLATFORM_ID);
  private map: any;
  private mapboxgl!: typeof import('mapbox-gl');
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private markerCount = 1;
  public markers: MarkerEntry[] = [];
  public addMarkerMode = false;
  public plannerCollapsed = false;
  public plannerPos = { x: 0, y: 0 };
  


  
//Creates a marker on the map
  private createMarker(map: mapboxgl.Map, nameIn: string, coords: any) {
    //create new marker & marker entry as placeholders
    const marker = new this.mapboxgl.Marker({ color: '#FF0000', scale: 0.9 })
      .setLngLat([coords["lng"], coords["lat"]])
      .setDraggable(true)
    marker.on('dragend', () => {
      this.updateRouteFromMarkers('driving');
    });
    const entry: MarkerEntry = {
      marker: marker,
      editable: false,
      name: nameIn,
      id: this.markerCount,
    };

    //create the popup
    const popupElement = document.createElement('div');
    popupElement.innerHTML = `
      <h1 contenteditable="${entry.editable}">${entry.name}</h1>
      <button id="removeButton" type="button">remove</button> 
      <button id="editButton" type="button">edit</button>
    `;

    //set button actions
    const removeButton = popupElement.querySelector('#removeButton')!;
      removeButton.addEventListener('click', () => {
        marker.remove();
        this.zone.run(() => {
          this.markers = this.markers.filter(e => e.marker !== marker);
          this.updateMarkers()
          this.updateRouteFromMarkers('driving');
          this.cdr.detectChanges();
        });
      });

      const editElement = popupElement.querySelector('h1') as HTMLElement;

      const editButton = popupElement.querySelector('#editButton')!;
      editButton.addEventListener('click', () => {
        this.zone.run(() => {
          entry.editable = !entry.editable;
          editElement.contentEditable = String(entry.editable);
          editElement.focus();
          this.cdr.detectChanges();
        });
      });
      editElement.addEventListener('blur', () => {
        this.zone.run(() => {
          entry.name = editElement.innerText.trim() || entry.name;
          this.cdr.detectChanges();
        });
      });

    //create popup with the HTML and set it on the marker
    const popup = new this.mapboxgl.Popup({ offset: 25 }).setDOMContent(popupElement);
    marker.setPopup(popup);

    //store marker with popup as marker
    entry.marker = marker

    //push onto list 
    this.markerCount++;
    this.markers.push(entry);
    this.updateMarkers();
    this.updateRouteFromMarkers('driving');
  }



//method for adding a marker on click based on addMarkerMode
  private onMapClick = (e: any) => {
    //console logs and checks
    console.log("onClick");
    console.log("marker mode:", this.addMarkerMode);
    const coords = e.lngLat
    if (!this.addMarkerMode) return;

    //create marker and add it to map
    this.createMarker(this.map, `Custom marker ${this.markerCount}`, coords);

    //update "add marker" button
    this.zone.run(() => {
      this.addMarkerMode = false;
      this.cdr.detectChanges();
    });
  };



//adds a route layer onto the map
  private ensureRouteLayer() {
    if (!this.map) return;

    // Create source/layer once
    if (!this.map.getSource('route')) {
      this.map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] },
        },
      });

      this.map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-width': 3,
        },
      });
    }
  }



//sets the path of the geometry 
  private setRouteGeometry(coords: number[][]) {
    const src = this.map?.getSource('route') as any;
    if (!src) return;

    src.setData({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coords,
      },
    });
  }



//gets marker coordinates
  private getMarkerCoords(): [number, number][] {
    return this.markers.map((m) => {
      const ll = m.marker.getLngLat();
      return [ll.lng, ll.lat];
    });
  }


  //updates the route based on the markers
  private async updateRouteFromMarkers(profile: 'driving' | 'walking' | 'cycling' = 'driving') {
    if (!this.map) return;

    this.ensureRouteLayer();

    const coords = this.getMarkerCoords();

    if (coords.length < 2) {
      this.setRouteGeometry([]);
      return;
    }

    const coordString = coords.map(([lng, lat]) => `${lng},${lat}`).join(';');

    const url =
      `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordString}` +
      `?geometries=geojson&overview=full&steps=false&access_token=${'pk.eyJ1IjoiMjNhemhhbmciLCJhIjoiY21qNXgyZTliMDZ3bDNmcTA5cGpjMGJxeSJ9.8WzQ1ADAhCJGMos5P5nsrw'}`;

    const res = await fetch(url);
    if (!res.ok) {
      console.warn('Directions API error:', res.status, await res.text());
      return;
    }

    const json = await res.json();
    const routeCoords: number[][] = json?.routes?.[0]?.geometry?.coordinates ?? [];

    this.setRouteGeometry(routeCoords);
  }



  //gets the position of drag then sets the planner position
  //allows planner to be dragged
  onPlannerDragEnd(e: CdkDragEnd) {
    const p = e.source.getFreeDragPosition();
    this.plannerPos = { x: p.x, y: p.y };
  }



  //removes and updates all markers on the map
  updateMarkers() {
    this.markers.forEach(entry => {
      entry.marker.remove()
    })

    this.markers.forEach(entry => {
      entry.marker.addTo(this.map)
    })
    console.log("updated all markers")
  };



  async ngAfterViewInit(): Promise<void> {
    // Skip on the server (prevents "document is not defined")
    if (!isPlatformBrowser(this.platformID)) return;
    // Lazy-import so mapbox-gl isn't evaluated during SSR
    const mapboxglMod: any = await import('mapbox-gl');
    const mapboxgl = mapboxglMod.default ?? mapboxglMod;
    mapboxgl.accessToken = 'pk.eyJ1IjoiMjNhemhhbmciLCJhIjoiY21qNXgyZTliMDZ3bDNmcTA5cGpjMGJxeSJ9.8WzQ1ADAhCJGMos5P5nsrw';
    this.mapboxgl = mapboxgl



    //create new map
    this.map = new mapboxgl.Map({
      container: 'map', // container id
      style: 'mapbox://styles/mapbox/streets-v12', //style
      center: [-74.5, 40], //starting pos
      zoom: 9 //starting zoom
    });
      

    
    //load the route layer on the map
    this.map.on('load', () => {
      this.ensureRouteLayer();
      this.updateRouteFromMarkers('driving');
    });


    //import search function and sync proximity to our viewbox
    await import('@mapbox/search-js-web');
    const searchBox = document.getElementById('searchbox') as any;
    searchBox.accessToken = mapboxgl.accessToken;
    //whenever we move, sync the searchbox to the user's location
    //gives user more relevant locations
    const syncToViewport = () => {
      console.log("moved")
      const center = this.map.getCenter();

      searchBox.options = {
        proximity: [center.lng, center.lat],
        limit: 10
      };
    };
    // Run once and then whenever the user pans/zooms
    syncToViewport();
    this.map.on('moveend', syncToViewport);



    //currently zooms into location when a location is retireved 
    searchBox.addEventListener('retrieve', (e: any) => {
      const feature = e.detail;
      console.log("retrieved a location: ", feature)
      const first = feature?.features?.[0];
      if (!first) {
        console.warn('No features returned from retrieve:', feature);
        return;
      }
      const [lng, lat] = first.geometry.coordinates;
      const location: Record<string, number> = {
        'lng': lng,
        'lat': lat,
      };
      this.map.flyTo({ center: [lng, lat], zoom: 15 });
      this.createMarker(this.map, first.properties.name, location)
      this.zone.run(() => {
        this.cdr.detectChanges();
      });
    });



    //add geolocation (locates the user)
    this.map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true,
    }));

    this.map.on('click', this.onMapClick);
  }


  //toggles add marker
  toggleAddMarkerMode() {
    this.addMarkerMode = !this.addMarkerMode;
  }

  //destroys all markers on map close
  ngOnDestroy() {
    if (this.map) this.map.off('click', this.onMapClick);
  }

  //toggles planner
  togglePlanner() {
    this.plannerCollapsed = !this.plannerCollapsed;
  }

  //moves the marker up
  moveMarkerUp(i: number) {
    if (i <= 0) return;
    [this.markers[i - 1], this.markers[i]] = [this.markers[i], this.markers[i - 1]];
    this.updateMarkers();
    this.updateRouteFromMarkers('driving');
  }

  //moves the marker down
  moveMarkerDown(i: number) {
    if (i >= this.markers.length - 1) return;
    [this.markers[i + 1], this.markers[i]] = [this.markers[i], this.markers[i + 1]];
    this.updateMarkers();
    this.updateRouteFromMarkers('driving');
  }
}
