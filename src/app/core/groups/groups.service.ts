import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface ScoutGroup {
  id: number;
  name: string;
  email: string | null;
  /** Código de la isla (`GRAN_CANARIA`), o null si no se indicó. */
  island: string | null;
  active: boolean;
  members: number;
  createdAt: string;
}

export interface IslandOption {
  code: string;
  name: string;
}

export interface ScoutGroupInput {
  name: string;
  email: string | null;
  island: string | null;
}

/** Listado de grupos scout que gestionan la administración y la secretaría. */
@Injectable({ providedIn: 'root' })
export class GroupsService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/admin/scout-groups';

  list(): Promise<ScoutGroup[]> {
    return firstValueFrom(this.http.get<ScoutGroup[]>(this.base));
  }

  islands(): Promise<IslandOption[]> {
    return firstValueFrom(this.http.get<IslandOption[]>(`${this.base}/islands`));
  }

  create(input: ScoutGroupInput): Promise<ScoutGroup> {
    return firstValueFrom(this.http.post<ScoutGroup>(this.base, input));
  }

  update(id: number, input: ScoutGroupInput): Promise<ScoutGroup> {
    return firstValueFrom(this.http.put<ScoutGroup>(`${this.base}/${id}`, input));
  }

  setActive(id: number, active: boolean): Promise<ScoutGroup> {
    return firstValueFrom(this.http.put<ScoutGroup>(`${this.base}/${id}/active`, { active }));
  }

  remove(id: number): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${this.base}/${id}`));
  }
}
