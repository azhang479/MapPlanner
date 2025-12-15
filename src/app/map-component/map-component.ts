import { Component, AfterViewInit, inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

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

  async ngAfterViewInit(): Promise<void> {
    // Skip on the server (prevents "document is not defined")
    if (!isPlatformBrowser(this.platformID)) return;
    
    // Lazy-import so mapbox-gl isn't evaluated during SSR
    const mapboxgl = (await import('mapbox-gl')).default;

    mapboxgl.accessToken =
      'pk.eyJ1IjoiMjNhemhhbmciLCJhIjoiY21qNXgyZTliMDZ3bDNmcTA5cGpjMGJxeSJ9.8WzQ1ADAhCJGMos5P5nsrw';

    this.map = new mapboxgl.Map({
      container: 'map', // container id
      style: 'mapbox://styles/mapbox/streets-v12', //style
      center: [-74.5, 40], //starting pos
      zoom: 9 //starting zoom
    });
    
    await import('@mapbox/search-js-web');

    const marker = new mapboxgl.Marker({
      color: '#FF0000',
      scale: .8
    })
    .setLngLat([-74.5, 40])
    .addTo(this.map);
    
    const searchBox = document.getElementById('searchbox') as any;
    searchBox.accessToken = mapboxgl.accessToken;

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

    // Optional: zoom to selected result + drop marker
    searchBox.addEventListener('retrieve', (e: any) => {
      console.log(e.detail)
      const feature = e.detail;
      const first = feature?.features?.[0];

      if (!first) {
        console.warn('No features returned from retrieve:', feature);
        return;
      }

      const [lng, lat] = first.geometry.coordinates;
      this.map.flyTo({ center: [lng, lat], zoom: 15 });
      new mapboxgl.Marker().setLngLat([lng, lat]).addTo(this.map);
    });
  }
}
