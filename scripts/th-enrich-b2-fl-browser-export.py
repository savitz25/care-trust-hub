"""Click the public AHCA CSV export control; no search pagination or bypass."""

from __future__ import annotations

from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "enrichment" / "th-enrich-b2" / "raw"


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(accept_downloads=True)
        for route, filename in (("Adult-DayCare", "fl_adult_day_care.csv"), ("Nurse-Registry", "fl_nurse_registry.csv")):
            destination = OUT / filename
            if destination.exists():
                continue
            page.goto(f"https://quality.healthfinder.fl.gov/Facility-Provider/{route}?type=1", wait_until="domcontentloaded", timeout=60000)
            page.locator("#dropdownMenuButton1").click()
            with page.expect_download(timeout=60000) as download_info:
                page.get_by_role("button", name="Download as CSV").click()
            download = download_info.value
            download.save_as(destination)
            print(route, download.suggested_filename, destination.stat().st_size)
        browser.close()


if __name__ == "__main__":
    main()
