-- Run05C: exact four public contact-location corrections, revalidated 2026-10-14.
-- Coordinates are already preserved in the October13 audit; no new geocoding.
-- Application prerequisite: successfully fetch the current Casa provider contact page
-- and match its address; search snippets alone are insufficient. See Run05C plan.
-- If verification fails, stop; prepare/review a separate batch excluding Casa.
-- Default is ROLLBACK. Change only the final statement to COMMIT after review.
-- A partial match aborts the entire update. A repeat safely fails the four-row guard.
begin;
create temporary table run05c_updated on commit drop as
with updated as (
update public.resource_map_locations as location
set latitude = repair.latitude,
    longitude = repair.longitude,
    geocoding_accuracy = 'street',
    city = coalesce(location.city, repair.city)
from (values
  ('aae3937f-f0f9-447e-b47e-267cced8a152'::uuid, '08c82ac9-7218-4bde-8e70-55056c319648'::uuid,
   '8801 South Saginaw Avenue, Chicago, IL', 'Chicago', 41.735396010419::double precision, -87.559607537896::double precision),
  ('136ab299-9984-40e9-b7ee-99df6cf24b95'::uuid, '20bce7f7-58b5-4db3-affd-8a679c6128e1'::uuid,
   '3001 West 111th Street, Suite 103, Chicago, IL', 'Chicago', 41.691563926184::double precision, -87.696234647443::double precision),
  ('402c10f5-1318-4353-819e-f7c6c712fd21'::uuid, 'aa012c72-7e63-49a3-8dad-401b8ebac232'::uuid,
   '3533 West North Avenue, Chicago, IL', 'Chicago', 41.909659::double precision, -87.715649::double precision),
  ('46c4ef41-2b6d-4f0e-ab04-f63461ebf74b'::uuid, 'f8b0fbf8-47a4-46db-9fa4-985441842b00'::uuid,
   '2500 West Higgins Road, Suite 360, Hoffman Estates, IL', 'Hoffman Estates', 42.059949866629::double precision, -88.143403143242::double precision)
) as repair(location_id, service_id, address, city, latitude, longitude)
where location.id = repair.location_id
  and location.service_id = repair.service_id
  and location.address_line1 = repair.address
  and location.latitude is null and location.longitude is null
  and location.city is null and location.geocoding_accuracy = 'unknown'
  and location.location_type = 'physical' and location.is_primary
  and exists (select 1 from public.resource_map_public_items item
              where item.item_id = repair.service_id and item.address_line1 = repair.address)
returning location.id, location.service_id, location.latitude, location.longitude,
          location.city, location.geocoding_accuracy
) select * from updated;
do $$ begin
  if (select count(*) from run05c_updated) <> 4 then
    raise exception 'Run05C expected exactly four matching unchanged public locations';
  end if;
end $$;
select * from run05c_updated order by id;
rollback;
