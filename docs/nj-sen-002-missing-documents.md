# NJ-SEN-002 — narrowly scoped missing-document request

After one controlled retry of previously failed public URLs, **2 of 1,146** indexed NJDOH enforcement PDFs remain unavailable (HTTP 404). All other index URLs were downloaded and SHA-256 hashed.

This request does **not** seek resident-level, complainant, medical, or other private data.

## Unavailable public documents

| Facility name | Source date | Title / action | Original href | Normalized URL | HTTP | Expected filename | Index |
|---|---|---|---|---|---|---|---|
| Seacrest Rehab and Healthcare Center | 2024-08-19 | Notice of Assessment of Penalties | `/health/healthfacilities/surveys-insp/EA-Seacrest-Rehab-and-Healthcare-Center-08192024.pdf.pdf` | https://www.nj.gov/health/healthfacilities/surveys-insp/EA-Seacrest-Rehab-and-Healthcare-Center-08192024.pdf.pdf | 404 | `EA-Seacrest-Rehab-and-Healthcare-Center-08192024.pdf.pdf` | https://www.nj.gov/health/healthfacilities/surveys-insp/enforcement_actions.shtml |
| Mount Laurel Center for Rehab and Healthcare | 2017-06-02 | Curtailment | `/health/healthfacilities/documents/EA_facilities/2017/ea-Mount-Laurel-Center-for-Rehab-and-Healthcare-06022017.pdf` | https://www.nj.gov/health/healthfacilities/documents/EA_facilities/2017/ea-Mount-Laurel-Center-for-Rehab-and-Healthcare-06022017.pdf | 404 | `ea-Mount-Laurel-Center-for-Rehab-and-Healthcare-06022017.pdf` | https://www.nj.gov/health/healthfacilities/surveys-insp/enforcement_actions.shtml |

The Seacrest href contains a duplicated `.pdf.pdf` suffix on the public index. The Mount Laurel 2017 file is linked under `documents/EA_facilities/2017/` and returns 404.

## Request language

Please provide either:

1. Electronic copies of the two specifically identified unavailable enforcement documents listed above; or

2. A machine-readable enforcement-document index covering at least these records, containing:
   - Facility license number
   - Facility ID (FacID)
   - Facility name
   - Document type
   - Document date
   - Effective date
   - Penalty/remedy as stated
   - Public filename or document identifier

Do not include resident, complainant, medical, or personnel-private fields.

The acquired corpus is already usable. This request is only for the two source-unavailable rows.
