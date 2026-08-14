from dataclasses import replace

import pytest

from care_ingest.registry import load_registry, validate_registry


def test_registry_has_one_enabled_implemented_source() -> None:
    sources = load_registry()
    implemented = [source for source in sources if source.enabled]
    assert [source.dataset_key for source in implemented] == ["nursing-home-provider-information"]
    assert all(
        source.official_landing_page.startswith("https://data.cms.gov/") for source in sources
    )


def test_registry_rejects_non_cms_url() -> None:
    source = load_registry()[0]
    with pytest.raises(ValueError, match="official HTTPS"):
        validate_registry((replace(source, documentation_url="https://example.com/guess"),))
