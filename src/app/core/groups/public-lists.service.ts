import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface PublicGroup {
  id: number;
  name: string;
}

export interface Branch {
  id: number;
  code: string;
  name: string;
}

/** Listas que se ofrecen al pedir una cuenta, antes de tener sesión: grupos activos y las cinco ramas. */
@Injectable({ providedIn: 'root' })
export class PublicListsService {
  private readonly http = inject(HttpClient);

  groups(): Promise<PublicGroup[]> {
    return firstValueFrom(this.http.get<PublicGroup[]>('/api/scout-groups/public'));
  }

  branches(): Promise<Branch[]> {
    return firstValueFrom(this.http.get<Branch[]>('/api/branches/public'));
  }
}
