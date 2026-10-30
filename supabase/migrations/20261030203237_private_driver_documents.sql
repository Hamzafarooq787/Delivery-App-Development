-- Apply after the authenticated document/proof routes are deployed.
update storage.buckets set public=false where id='driver-documents';
