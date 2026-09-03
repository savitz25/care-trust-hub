from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_hub_snapshot_rebuilds_and_checks_network_metrics() -> None:
    snapshot = (ROOT / "scripts" / "sen-nat-013-hub-snapshot.py").read_text(encoding="utf-8")
    assert "build-senior-network-metrics.py" in snapshot
    assert "check-senior-network-metrics-stale.py" in snapshot


def test_cms_refresh_and_ci_fail_closed_on_stale_manifest() -> None:
    refresh = (ROOT / ".github" / "workflows" / "cms-refresh.yml").read_text(encoding="utf-8")
    ci = (ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    assert "check-senior-network-metrics-stale.py" in refresh
    assert "check-senior-network-metrics-stale.py" in ci
