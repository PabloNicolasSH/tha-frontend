import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../auth/auth.service';

interface NavLink {
  path: string;
  label: string;
  exact: boolean;
}

@Component({
  selector: 'tha-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
})
export class Shell {
  protected readonly auth = inject(AuthService);

  /** Enlaces del menú. Los de administración solo los ven quienes tienen el rol. */
  protected readonly links = computed<NavLink[]>(() => {
    const links: NavLink[] = [
      { path: '/', label: 'Inicio', exact: true },
      { path: '/tesoreria', label: 'Tesorería', exact: false },
    ];
    if (this.auth.hasRole('ADMIN', 'SECRETARY')) {
      links.push({ path: '/admin/solicitudes', label: 'Solicitudes de cuenta', exact: false });
      links.push({ path: '/admin/grupos', label: 'Grupos scout', exact: false });
    }
    return links;
  });
}
