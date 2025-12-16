import { Component, AfterViewInit, inject, CUSTOM_ELEMENTS_SCHEMA, NgZone, provideAppInitializer} from '@angular/core';
import { PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

//All entries needed to describe a marker
type MarkerEntry = {
  marker: mapboxgl.Marker; 
  editable: boolean;
  id: number;
};

@Component({
  selector: 'app-map-component',
  imports: [],
  templateUrl: './map-component.html',
  styleUrl: './map-component.sass',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})


export class MapComponent {
  private platformID = inject(PLATFORM_ID);
  private map: any;
  public addMarkerMode = false;
  private markers: MarkerEntry[] = [];
  private mapboxgl!: typeof import('mapbox-gl');
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private markerCount = 1;
  


  //method for adding a marker on click based on addMarkerMode
  private onMapClick = (e: any) => {
    //console logs and checks
    console.log("onClick")
    console.log("marker mode:", this.addMarkerMode)
    const coords = e.lngLat
    if (!this.addMarkerMode) return;

    //create new marker & marker entry as placeholders
    const marker = new this.mapboxgl.Marker({ color: '#FF0000', scale: 0.9 })
      .setLngLat([coords["lng"], coords["lat"]])
      .setDraggable(true)
    const entry: MarkerEntry = {
      marker: marker,
      editable: false,
      id: this.markerCount
    };

    //create the popup
    const popupElement = document.createElement('div');
    popupElement.innerHTML = `
      <h1 contenteditable="${entry.editable}">Custom marker ${this.markerCount}</h1>
      <button id="removeButton" type="button">remove</button> 
      <button id="editButton" type="button">edit</button>
    `;

    //set button actions
    const removeButton = popupElement.querySelector('#removeButton')!;
    removeButton.addEventListener('click', () => {
      marker.remove();
      this.markerCount--;
      this.markers = this.markers.filter(e => e.marker !== marker);
    });
    const editButton = popupElement.querySelector('#editButton')!;
    editButton.addEventListener('click', () => {
        entry.editable = !entry.editable;
    });

    //create popup with the HTML and set it on the marker
    const popup = new this.mapboxgl.Popup({ offset: 25 }).setDOMContent(popupElement);
    marker.setPopup(popup);

    //store marker with popup as marker
    entry.marker = marker

    //push onto list 
    this.markerCount++;
    this.markers.push(entry);
    this.updateMarkers()

    //update "add marker" button
    this.zone.run(() => {
      this.addMarkerMode = false;
      this.cdr.detectChanges();
    });
  };



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
      console.log("retrieved a location")
      const feature = e.detail;
      const first = feature?.features?.[0];
      if (!first) {
        console.warn('No features returned from retrieve:', feature);
        return;
      }
      const [lng, lat] = first.geometry.coordinates;
      this.map.flyTo({ center: [lng, lat], zoom: 15 });
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
}
