import { AfterViewInit, Component, ElementRef, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { rise } from '../../core/motion/motion';

@Component({
  selector: 'tha-home',
  templateUrl: './home.html',
})
export class Home implements AfterViewInit {
  protected readonly auth = inject(AuthService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  ngAfterViewInit(): void {
    rise(this.host.nativeElement.querySelectorAll('[data-rise]'));
  }
}
