-- Optional. Run in the SQL Editor after schema.sql if you want a few test
-- listings to browse/swipe immediately. These have no photos (a real
-- upload always goes through the Sell form in the app) -- the Buy view
-- falls back to a generated placeholder image for listings with no photos.

-- Seller phones live in listing_contacts (never publicly readable), so
-- each row is inserted into both tables.
with seed (title, location, type, unit, area, price, advantages, seller_name, seller_phone) as (
  values
  ('Corner site near Gokulam 3rd Stage', 'Gokulam', 'site', 'sqft', 2400, 9600000, '{"Corner plot","Wide road","Near park"}', 'Ramesh K.', '+91 90000 00001'),
  ('Gated layout site, Gokulam', 'Gokulam', 'site', 'sqft', 2000, 11000000, '{"Gated community","24x7 water"}', 'Priya S.', '+91 90000 00002'),
  ('Commercial plot on Vijayanagar main road', 'Vijayanagar', 'commercial', 'sqft', 3000, 15000000, '{"Main road facing","High footfall"}', 'Suresh Traders', '+91 90000 00003'),
  ('2-acre farmland near Bogadi', 'Bogadi', 'agri', 'acres', 2, 8000000, '{"Borewell available","Road access","Fertile red soil"}', 'Nagaraju M.', '+91 90000 00004'),
  ('Compact site in Hebbal', 'Hebbal', 'site', 'sqft', 1200, 4200000, '{"Close to ring road","Corner site"}', 'Lakshmi N.', '+91 90000 00005')
), inserted as (
  insert into listings (title, location, type, unit, area, price, advantages, seller_name)
  select title, location, type, unit, area, price, advantages::text[], seller_name from seed
  returning id, title
)
insert into listing_contacts (listing_id, seller_phone)
  select inserted.id, seed.seller_phone from inserted join seed using (title);
