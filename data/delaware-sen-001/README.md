# Delaware senior-care directory evidence (DE-SEN-001)

Raw pages retrieved October 12, 2026. Source-native class rows and license identifiers are summarized in `derived/directory-observations.csv`; repeated identifiers are in `derived/repeated-license-identifiers.csv`. Run `python scripts/summarize_de_sen_001.py` to rebuild those summaries using only Python's standard library.

| Class/source page | Raw file | SHA-256 |
| --- | --- | --- |
| [Nursing homes](https://dhss.delaware.gov/dhcq/dhcq/licensed-nursing-homes/) | `raw/nursing-homes.html` | `6C7A3BABCA86289576C9FA6A81DF9200E841DF716A9CCF96729C6E3E7FE38BC1` |
| [Assisted living](https://dhss.delaware.gov/dhcq/dhcq/licensed-assisted-living-facilities/) | `raw/assisted-living.html` | `450DF585877E53BB696D22724AB7DDEF557CCE18D12756B9F579E8AF048376FA` |
| [Adult day care](https://dhss.delaware.gov/dhcq/dhcq/adult-day-care-centers/) | `raw/adult-day.html` | `9549923A766795823F3D1997D3FC98B29FD8CB38BF1AFFCDA7E615217F354BB9` |
| [Home health – aides only](https://dhss.delaware.gov/dhcq/dhcq/home-health-agencies-aides-only/) | `raw/home-health-aides-only.html` | `1909EE40861E56236166392D95501E47D65E26FE8AD75CB8F4E26B37F0DC8162` |
| [Home health – skilled](https://dhss.delaware.gov/dhcq/dhcq/home-health-agencies-skilled/) | `raw/home-health-skilled.html` | `15C9E4D759E721BECC5C1B64D32367E57490E92EA322DFE062647637431467F9` |
| [Hospice](https://dhss.delaware.gov/dhcq/dhcq/hospice-providers/) | `raw/hospice.html` | `8B4DB9721969890EC646FE669616D7A26F47B29D29263FE5C259A6AE717ABC4B` |
| [Personal assistance agencies](https://dhss.delaware.gov/dhcq/dhcq/personal-assistance-services-agencies/) | `raw/personal-assistance-agencies.html` | `4DB52965C35EEBD092D7A50DC4291360D36C9720195792CB2F79F0EBCB483DB4` |

Past expiration dates are source observations requiring regulator confirmation, not an automatic license-status conclusion. Nursing-home and assisted-living pages did not expose expiration dates in their listing rows. No cross-class sum is stored or published.
