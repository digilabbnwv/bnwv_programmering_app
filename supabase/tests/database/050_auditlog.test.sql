-- De auditlog kan door niemand worden gewijzigd of verwijderd, ook niet door
-- de service role of de database-eigenaar.
begin;
select plan(6);

select private.write_audit(null, 'test.regel', null, '{"a": 1}');

select throws_ok($$ update public.audit_log set action = 'test.anders' $$, '42501',
  'De auditlog kan niet worden gewijzigd of verwijderd', 'eigenaar kan regels niet wijzigen');
select throws_ok($$ delete from public.audit_log $$, '42501',
  'De auditlog kan niet worden gewijzigd of verwijderd', 'eigenaar kan regels niet verwijderen');
select throws_ok($$ truncate public.audit_log $$, '42501',
  'De auditlog kan niet worden gewijzigd of verwijderd', 'eigenaar kan de log niet leegmaken');

set local role service_role;
select throws_ok($$ delete from public.audit_log $$, '42501', null,
  'service role kan regels niet verwijderen');
reset role;

select throws_ok($$ select private.write_audit(null, 'GEEN geldige actie', null) $$, '23514', null,
  'acties moeten de vorm onderwerp.actie hebben');

select is((select count(*) from public.audit_log where action = 'test.regel'), 1::bigint,
  'de regel staat er nog');

select * from finish();
rollback;
