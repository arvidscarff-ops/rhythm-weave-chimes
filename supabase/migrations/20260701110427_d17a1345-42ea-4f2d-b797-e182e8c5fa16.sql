
DROP POLICY IF EXISTS "Authenticated write pack covers" ON storage.objects;
CREATE POLICY "Authenticated write pack covers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'pack-covers');

DROP POLICY IF EXISTS "Authenticated update pack covers" ON storage.objects;
CREATE POLICY "Authenticated update pack covers"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'pack-covers');

DROP POLICY IF EXISTS "Authenticated delete pack covers" ON storage.objects;
CREATE POLICY "Authenticated delete pack covers"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'pack-covers');
