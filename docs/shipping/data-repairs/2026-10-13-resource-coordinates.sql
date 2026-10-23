-- Explicit production data step after review; not an automatically applied migration.
-- Evidence and before-values: docs/plans/2026-10-13-resource-map-audit.md.
-- Census matches are street-level, not rooftop or proof of walk-in availability.
-- These are already published public contact addresses. Confidential shelters,
-- online-only organizations and unspecified multi-location services are excluded.
begin;
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
  and location.location_type = 'physical' and location.is_primary
  and exists (select 1 from public.resource_map_public_items item
              where item.item_id = repair.service_id and item.address_line1 = repair.address)
returning location.id, location.service_id, location.latitude, location.longitude;
-- Expected: four rows on the audited production snapshot; zero on a safe repeat.
-- Inspect RETURNING before COMMIT. Roll back unexpected results.
-- COMMIT; -- deliberately requires the operator's final step
