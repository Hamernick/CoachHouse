-- Exact rollback of Run05C only; original city/coordinates null and accuracy unknown.
-- Refuses to overwrite any subsequent edit to these fields. Default is dry-run.
begin;
create temporary table run05c_reverted on commit drop as
with reverted as (
 update public.resource_map_locations location
 set latitude = null, longitude = null, city = null, geocoding_accuracy = 'unknown'
 from (values
  ('aae3937f-f0f9-447e-b47e-267cced8a152'::uuid, '08c82ac9-7218-4bde-8e70-55056c319648'::uuid, 41.735396010419::double precision, -87.559607537896::double precision, 'Chicago'),
  ('136ab299-9984-40e9-b7ee-99df6cf24b95'::uuid, '20bce7f7-58b5-4db3-affd-8a679c6128e1'::uuid, 41.691563926184::double precision, -87.696234647443::double precision, 'Chicago'),
  ('402c10f5-1318-4353-819e-f7c6c712fd21'::uuid, 'aa012c72-7e63-49a3-8dad-401b8ebac232'::uuid, 41.909659::double precision, -87.715649::double precision, 'Chicago'),
  ('46c4ef41-2b6d-4f0e-ab04-f63461ebf74b'::uuid, 'f8b0fbf8-47a4-46db-9fa4-985441842b00'::uuid, 42.059949866629::double precision, -88.143403143242::double precision, 'Hoffman Estates')
 ) as expected(id, service_id, latitude, longitude, city)
 where location.id = expected.id and location.service_id = expected.service_id
   and location.latitude = expected.latitude and location.longitude = expected.longitude
   and location.city = expected.city and location.geocoding_accuracy = 'street'
 returning location.id, location.service_id, location.latitude, location.longitude, location.city, location.geocoding_accuracy
) select * from reverted;
do $$ begin
 if (select count(*) from run05c_reverted) <> 4 then
   raise exception 'Run05C rollback expected four unchanged repaired locations';
 end if;
end $$;
select * from run05c_reverted order by id;
rollback;
