import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PublicListsService } from '../groups/public-lists.service';
import { AdminRequestsService } from './admin-requests.service';

describe('AdminRequestsService.changeGroup', () => {
  let service: AdminRequestsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AdminRequestsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('corrige el grupo, o lo quita con null', async () => {
    const done = service.changeGroup(5, 7);
    const req = http.expectOne({ method: 'PUT', url: '/api/admin/account-requests/5/group' });
    expect(req.request.body).toEqual({ scoutGroupId: 7 });
    req.flush({ id: 5 });
    await done;

    const none = service.changeGroup(5, null);
    http.expectOne('/api/admin/account-requests/5/group').flush({ id: 5 });
    await none;
  });

  it('las listas públicas se piden sin sesión a sus rutas públicas', async () => {
    const lists = TestBed.inject(PublicListsService);
    const groups = lists.groups();
    http.expectOne('/api/scout-groups/public').flush([]);
    const branches = lists.branches();
    http.expectOne('/api/branches/public').flush([]);
    expect(await groups).toEqual([]);
    expect(await branches).toEqual([]);
  });
});
