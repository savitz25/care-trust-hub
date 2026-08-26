# SEN-NAT-005W — Gated durable-worker write of discovered CMS releases

First controlled production write through the SEN-NAT-005 refresh architecture.

- Base SHA: `687c27f1532dd848c313085a30839ad15fd71c61`
- Parent write run: `12746ec2-0fe7-4593-a581-c1121f046f7b`
- Writes: process-local `CARE_CMS_REFRESH_WRITES=true` on durable worker only
- Scheduled GitHub evidence writes: still disabled

Artifacts: `docs/sen-nat-005w-prewrite.json`, `docs/sen-nat-005w-cohort.json`, `docs/sen-nat-005w-write.json`, `docs/sen-nat-005w-postwrite.json`, `docs/sen-nat-005w-idempotent.json`.

CHOW change detection now treats a newer catalog `source_modified_at` as DISCOVERED even when the version UUID is unchanged. Identical bytes still short-circuit to `NO_CHANGE` after checksum.
