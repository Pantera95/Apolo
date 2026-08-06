# Permisos del panel — diseño, no implementación

## Estado actual: honesto sobre lo que no hay

**Apolo no tiene autenticación.** Los roles del dominio (`owner`,
`administrador`, `aprobador`, `almacenista`, `chofer`, `solicitante`,
`consulta`) existen para modelar la máquina de estados de las solicitudes —
quién puede mover qué—, no para restringir el acceso. La propia aplicación lo
dice en pantalla: *"los permisos son estructura, no seguridad"*.

Por eso este documento **diseña** el reparto y no lo implementa. Poner un filtro
por rol en el cliente sin RLS detrás sería peor que no tenerlo: daría la
apariencia de control sin ninguno.

## Reparto propuesto por rol

| Rol | Ve del panel | No ve |
|---|---|---|
| Administrador general | Todo | — |
| Gerente de operaciones | Todo | — |
| Gerente de obra | Solo sus obras; KPIs recortados a ellas | Valor total de inventario, compras de otras obras |
| Encargado de almacén | Su almacén: inventario, stock crítico, preparación | Costos de compra, obras ajenas |
| Compras | Órdenes, proveedores, valor por recibir, stock crítico | Herramienta, detalle de obra |
| Logística | Despachos, entregas, en ruta | Costos de compra, inventario valorizado |
| Auditor | Todo en lectura, incluida la reconciliación | Ninguna acción |
| Analista | Métricas agregadas | Datos nominales de responsables |
| Solo lectura | Tarjetas y gráficas | Exportación y acciones |

## Cómo se implementaría con Supabase

La restricción tiene que vivir en la base, no en el componente.

```sql
-- El gerente de obra solo ve las obras que tiene asignadas.
create policy obras_visibles on obras
for select using (
  auth.uid() in (select usuario_id from asignaciones where obra_id = obras.id)
  or exists (select 1 from roles_usuario
             where usuario_id = auth.uid()
               and rol in ('administrador','gerente_operaciones','auditor'))
);
```

Las vistas y funciones RPC del panel deben declararse `security invoker` para
que hereden las políticas de las tablas base. Una vista `security definer` sobre
tablas con RLS **salta la restricción** y filtra datos de todas las obras a
cualquiera que pueda llamarla: es el error clásico de este patrón.

Los KPIs agregados necesitan cuidado aparte: un total de inventario que el rol
no puede desglosar sigue revelando información. Para los roles recortados, el
agregado debe calcularse sobre el subconjunto visible, no sobre el total.

## Qué NO hacer

- No filtrar por rol solo en el cliente.
- No exponer la `service_role key` en el frontend bajo ninguna circunstancia.
- No confiar en que ocultar una tarjeta protege el dato que hay debajo.
