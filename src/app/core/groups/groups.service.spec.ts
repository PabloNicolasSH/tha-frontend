import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GroupsService, ScoutGroup } from './groups.service';

const group: ScoutGroup = {
  id: 3,
  name: 'Bentaya',
  email: null,
  island: null,
  active: true,
  members: 0,
  createdAt: '2026-10-19T10:00:00Z',
};

describe('GroupsService', () => {
  let service: GroupsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(GroupsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista los grupos', async () => {
    const done = service.list();
    http.expectOne({ method: 'GET', url: '/api/admin/scout-groups' }).flush([group]);
    expect(await done).toEqual([group]);
  });

  it('crea y edita con los datos indicados', async () => {
    const input = { name: 'Teide', email: 'teide@example.org', island: 'TENERIFE' };

    const created = service.create(input);
    const post = http.expectOne({ method: 'POST', url: '/api/admin/scout-groups' });
    expect(post.request.body).toEqual(input);
    post.flush({ ...group, ...input });
    await created;

    const updated = service.update(3, input);
    const put = http.expectOne({ method: 'PUT', url: '/api/admin/scout-groups/3' });
    expect(put.request.body).toEqual(input);
    put.flush({ ...group, ...input });
    await updated;
  });

  it('desactiva, reactiva y borra', async () => {
    const off = service.setActive(3, false);
    const req = http.expectOne({ method: 'PUT', url: '/api/admin/scout-groups/3/active' });
    expect(req.request.body).toEqual({ active: false });
    req.flush({ ...group, active: false });
    expect((await off).active).toBe(false);

    const removed = service.remove(3);
    http.expectOne({ method: 'DELETE', url: '/api/admin/scout-groups/3' }).flush(null, { status: 204, statusText: 'No Content' });
    await removed;
  });
});
