// Generator adapters: values come from accepted artifacts, never manually maintained totals.
import NJ from "../../../artifacts/nj-sen-005-public-snapshot.json";
export const NJ_ACCEPTED = {
  ltcRows: NJ.ltc.rows,
  acuteRows: NJ.acute.rows,
  enforcementIndexed: NJ.enforcement.indexed,
  enforcementDownloaded: NJ.enforcement.downloaded,
  enforcementUniqueHashes: NJ.enforcement.uniqueHashes,
};
import CA from "../../../artifacts/ca-sen-001-public-snapshot.json";
export const CA_ACCEPTED = {
  elmsRows: CA.elms.source_row_count,
  rcfeLicensed: CA.rcfe.licensed,
  snfExact: CA.crosswalk.snf.exact_matches,
};
import TX from "../../../artifacts/tx-sen-001-public-snapshot.json";
export const TX_ACCEPTED = {
  hhscNf: TX.hhscNursingFacilities.source_row_count,
  hhscAlf: TX.hhscAssistedLiving.source_row_count,
  hhscHcssa: TX.hhscHcssa.source_row_count,
  hhscNfExactCms: TX.crosswalk.nfToCmsNh.exact_matches,
  hhscAsOf: TX.hhscNursingFacilities.source_as_of,
};
import WA from "../../../artifacts/wa-sen-001-public-snapshot.json";
export const WA_ACCEPTED = {
  afh: WA.adultFamilyHomes.count,
  alf: WA.assistedLiving.count,
  esf: WA.enhancedServices.count,
  gisCurrent: WA.dshsGis.profile.rows,
  cmsNursingHomes: WA.cmsOverlay.nursingHomes,
  stateNhCurrent: WA.stateNursingHomeSource.acquired.current_count,
  stateNhExactCms: WA.crosswalk.stateNhToCmsNh.exact_matches,
  gisAsOf: WA.asOf,
};
import AZ from "../../../artifacts/az-sen-001-public-snapshot.json";
export const AZ_ACCEPTED = {
  gisRows: AZ.adhsGis.rows,
  gisRun: AZ.adhsGis.run_date,
  alHome: AZ.assistedLivingHomes.rows,
  alCenter: AZ.assistedLivingCenters.rows,
  afc: AZ.adultFosterCare.rows,
  nhExact: AZ.crosswalk.stateNhToCmsNh.exact_matches,
  hhaExact: AZ.crosswalk.stateHhaToCmsHha.exact_matches,
  hospiceExact: AZ.crosswalk.stateHospiceToCmsHospice.exact_matches,
};
import CO from "../../../artifacts/co-sen-001-public-snapshot.json";
export const CO_ACCEPTED = {
  cmsNursingHomes: CO.cmsOverlay.nursingHomes,
  cmsHomeHealth: CO.cmsOverlay.homeHealth,
  cmsHospice: CO.cmsOverlay.hospice,
  overlayAsOf: CO.cmsOverlay.asOf,
};
import VA from "../../../artifacts/va-sen-001-public-snapshot.json";
export const VA_ACCEPTED = {
  alfCount: VA.dssAlf.licensedFacilityCount,
  adcCount: VA.dssAdc.licensedFacilityCount,
  alfInspections: VA.dssAlfInspections.observationCount,
  cmsNursingHomes: VA.cmsOverlay.nursingHomes,
  snapshotAsOf: VA.snapshotAsOf,
};
import NY from "../../../artifacts/ny-sen-001-public-snapshot.json";
export const NY_ACCEPTED = {
  acfFacilities: NY.acf.acfFacilities,
  nhFacilities: NY.nursingHomeProfile.distinctFacilityIds,
  nhDistinctCcn: NY.nursingHomeProfile.distinctCcn,
  cmsNursingHomes: NY.cmsOverlay.nursingHomes,
  snapshotAsOf: NY.snapshotAsOf,
};
import IL from "../../../artifacts/il-sen-001-public-snapshot.json";
export const IL_ACCEPTED = {
  cmsNursingHomes: IL.cmsOverlay.nursingHomes,
  idphHomeHealth: IL.idphHomeHealth.rows,
  slpSites: IL.supportiveLiving.operationalSites,
  snapshotAsOf: IL.snapshotAsOf,
};
import OR from "../../../artifacts/or-sen-001-public-snapshot.json";
export const OR_ACCEPTED = {
  openNf: OR.odhsProviders.OPEN_NF,
  openAlf: OR.odhsProviders.OPEN_ALF,
  cmsNursingHomes: OR.cmsOverlay.nursingHomes,
  snapshotAsOf: OR.snapshotAsOf,
};
import PA from "../../../artifacts/pa-sen-001-public-snapshot.json";
export const PA_ACCEPTED = {
  nursingHomeRows: PA.nursingHomes.PA_NURSING_HOME_ROWS,
  homeHealthRows: PA.homeHealth.PA_HOME_HEALTH_ROWS,
  homeCareRows: PA.homeCare.PA_HOME_CARE_ROWS,
  cmsNursingHomes: PA.cmsOverlay.nursingHomes,
  snapshotAsOf: PA.snapshotAsOf,
};
import NC from "../../../artifacts/nc-sen-001-public-snapshot.json";
export const NC_ACCEPTED = {
  adultCareHomes: NC.adultCareHomes.NC_ADULT_CARE_HOME_ROWS,
  familyCareHomes: NC.familyCareHomes.NC_FAMILY_CARE_HOME_ROWS,
  nursingHomeRows: NC.nursingHomes.NC_NURSING_HOME_ROWS,
  homeHealthRows: NC.homeHealth.NC_HOME_HEALTH_ROWS,
  cmsNursingHomes: NC.cmsOverlay.nursingHomes,
  snapshotAsOf: NC.snapshotAsOf,
};
import OH from "../../../artifacts/oh-sen-001-public-snapshot.json";
export const OH_ACCEPTED = {
  nursingFacilityRows: OH.nursingHomes.OH_NURSING_FACILITY_ROWS,
  rcfRows: OH.rcf.OH_RCF_ROWS,
  cmsNursingHomes: OH.cmsOverlay.CMS_OH_NURSING_HOME_ROWS,
  snapshotAsOf: OH.asOf,
};
