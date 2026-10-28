alter table public.jzb_tasks drop constraint jzb_tasks_section_check;
alter table public.jzb_tasks add constraint jzb_tasks_section_check check(section in ('Jefe Jefatura Zonas de Bienestar','Sub Jefe Jefatura Zonas de Bienestar','Asistencial','Coordinación Habitacional','Servicio Bandas','Planificación','Personal','Finanzas','Recreacional','Logística','Seguridad'));
alter table public.profiles drop constraint profiles_section_check;
alter table public.profiles add constraint profiles_section_check check(section in ('Asistencial','Coordinación Habitacional','Servicio Bandas','Planificación','Personal','Finanzas','Recreacional','Logística','Seguridad'));
