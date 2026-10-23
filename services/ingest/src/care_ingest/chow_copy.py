"""Public CHOW sentences. CMS publishes Home Health and Hospice files.

These sentences replace the false claim that CMS does not publish those files.
Profiles stay on the not-yet-linked sentence until a reviewed load attaches events.
"""

from __future__ import annotations


def chow_not_yet_integrated_copy(program: str) -> str:
    if program not in {"Home Health", "Hospice"}:
        raise ValueError(f"unsupported CHOW program label: {program}")
    return (
        f"CMS publishes {program} change-of-ownership (CHOW) files with its enrollment data. "
        "They are not yet linked to profiles on SeniorTrustHub. If no CHOW record is shown "
        "here, that does not prove ownership never changed."
    )


def chow_combined_not_yet_linked_copy() -> str:
    return (
        "CMS publishes Home Health and Hospice CHOW files with its enrollment data. "
        "SeniorTrustHub has not linked them to profiles yet."
    )


def chow_loaded_copy(file_date: str, count: int) -> str:
    noun = "event" if count == 1 else "events"
    return (
        f"CMS CHOW records (enrollment data, file dated {file_date}) list {count} "
        f"ownership-change {noun} for this enrollment. They only cover currently approved "
        "enrollments, so this is not a full ownership history."
    )


def chow_ask_copy() -> str:
    return "CMS publishes Home Health and Hospice CHOW files; this system has not linked them yet."
