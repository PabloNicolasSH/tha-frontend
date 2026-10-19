import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DialogHost } from './shared/ui/dialog/dialog-host';
import { ToastHost } from './shared/ui/toast/toast-host';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, DialogHost, ToastHost],
  template: '<router-outlet /><tha-dialog-host /><tha-toast-host />',
})
export class App {}
