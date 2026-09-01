BEGIN;

-- FL-SEN-006B: lock down unpublished Florida profile projections.
-- Additive security only. Does not change payload contract or publication state.
-- Public pages must use the application publication gate, not PostgREST.

REVOKE ALL ON TABLE public.state_provider_profile FROM PUBLIC;
REVOKE ALL ON TABLE public.state_provider_profile FROM anon;
REVOKE ALL ON TABLE public.state_provider_profile FROM authenticated;

GRANT SELECT ON TABLE public.state_provider_profile TO service_role;

ALTER TABLE public.state_provider_profile ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.state_provider_profile IS
  'FL-SEN-006/006B internal Florida P0 profile projections. RLS on. anon and authenticated have no table privilege. Not public. publication_state is internal_only until a later publication gate.';

COMMIT;
