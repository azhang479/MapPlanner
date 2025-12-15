import { Component, signal } from '@angular/core';
import { MapComponent } from "./map-component/map-component";

@Component({
  selector: 'app-root',
  imports: [MapComponent],
  templateUrl: './app.html',
  styleUrl: './app.sass'
})
export class App {
  protected readonly title = signal('MapPlanner');
}
