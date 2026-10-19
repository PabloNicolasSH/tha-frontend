import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Branch, PublicGroup, PublicListsService } from '../../core/groups/public-lists.service';
import { nudge, rise } from '../../core/motion/motion';

/** Solicitud de cuenta: sin contraseña. Cuando la federación la apruebe, llega un enlace para crearla. */
@Component({
  selector: 'tha-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
})
export class Register implements OnInit, AfterViewInit {
  private readonly auth = inject(AuthService);
  private readonly lists = inject(PublicListsService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    surname: ['', [Validators.required, Validators.maxLength(160)]],
    email: ['', [Validators.required, Validators.email]],
    // Opcionales: '' es «Ninguno (federación)» / «Ninguna»
    scoutGroupId: [''],
    branchId: [''],
  });
  protected readonly groups = signal<PublicGroup[]>([]);
  protected readonly branches = signal<Branch[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);

  async ngOnInit(): Promise<void> {
    // Si las listas no cargan, la solicitud sigue siendo posible: grupo y rama son opcionales
    const [groups, branches] = await Promise.allSettled([this.lists.groups(), this.lists.branches()]);
    if (groups.status === 'fulfilled') this.groups.set(groups.value);
    if (branches.status === 'fulfilled') this.branches.set(branches.value);
  }

  ngAfterViewInit(): void {
    rise(this.host.nativeElement.querySelectorAll('[data-rise]'));
  }

  protected invalid(name: 'name' | 'surname' | 'email'): boolean {
    const c = this.form.controls[name];
    return c.touched && c.invalid;
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const { scoutGroupId, branchId, ...person } = this.form.getRawValue();
      await this.auth.register({
        ...person,
        scoutGroupId: scoutGroupId ? Number(scoutGroupId) : null,
        branchId: branchId ? Number(branchId) : null,
      });
      this.sent.set(true);
    } catch (e) {
      this.error.set(
        e instanceof HttpErrorResponse && e.error?.detail ? e.error.detail : 'No se ha podido enviar la solicitud.',
      );
      nudge(this.host.nativeElement.querySelector('form'));
    } finally {
      this.busy.set(false);
    }
  }
}
