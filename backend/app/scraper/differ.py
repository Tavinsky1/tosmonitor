"""
Diff Engine — compares two text snapshots and produces structured diffs.

Uses Python's difflib for the actual diff, then structures the output
into sections with added/removed/changed classification.
"""

import difflib
import re
from dataclasses import dataclass, field


@dataclass
class DiffSection:
    """A section of text that changed."""
    heading: str = ""
    old_text: str = ""
    new_text: str = ""
    change_type: str = "modified"  # added, removed, modified


@dataclass
class DiffResult:
    """Complete diff result between two text versions."""
    has_changes: bool = False
    sections: list[DiffSection] = field(default_factory=list)
    words_added: int = 0
    words_removed: int = 0
    sections_changed: int = 0
    diff_html: str = ""
    similarity_ratio: float = 1.0


def compute_diff(old_text: str, new_text: str) -> DiffResult:
    """
    Compare two text versions and produce a structured diff.

    Returns a DiffResult with:
    - sections: list of changed sections
    - words_added / words_removed counts
    - diff_html: visual HTML diff
    - similarity_ratio: 0.0 (completely different) to 1.0 (identical)
    """
    if old_text == new_text:
        return DiffResult(has_changes=False, similarity_ratio=1.0)

    old_lines = old_text.splitlines(keepends=True)
    new_lines = new_text.splitlines(keepends=True)

    # Compute similarity ratio
    matcher = difflib.SequenceMatcher(None, old_text, new_text)
    ratio = matcher.ratio()

    # Generate unified diff
    diff_lines = list(difflib.unified_diff(
        old_lines, new_lines,
        fromfile="Previous Version",
        tofile="Current Version",
        lineterm="",
    ))

    if not diff_lines:
        return DiffResult(has_changes=False, similarity_ratio=ratio)

    # Parse diff into sections
    sections = _parse_diff_sections(diff_lines, old_lines, new_lines)

    # Count word changes
    old_words = set(old_text.split())
    new_words = set(new_text.split())
    words_added = len(new_words - old_words)
    words_removed = len(old_words - new_words)

    # Generate HTML diff
    diff_html = _generate_html_diff(old_lines, new_lines)

    return DiffResult(
        has_changes=True,
        sections=sections,
        words_added=words_added,
        words_removed=words_removed,
        sections_changed=len(sections),
        diff_html=diff_html,
        similarity_ratio=ratio,
    )


def _parse_diff_sections(
    diff_lines: list[str],
    old_lines: list[str],
    new_lines: list[str],
) -> list[DiffSection]:
    """Parse unified diff output into structured sections."""
    sections = []
    current_removed = []
    current_added = []
    current_heading = ""

    for line in diff_lines:
        # Skip diff headers
        if line.startswith("---") or line.startswith("+++"):
            continue

        # Section marker
        if line.startswith("@@"):
            # Flush previous section
            if current_removed or current_added:
                sections.append(_make_section(current_heading, current_removed, current_added))
                current_removed = []
                current_added = []
            continue

        if line.startswith("-"):
            text = line[1:].strip()
            if text:
                current_removed.append(text)
                # Try to detect heading context
                if _looks_like_heading(text):
                    current_heading = text
        elif line.startswith("+"):
            text = line[1:].strip()
            if text:
                current_added.append(text)
                if _looks_like_heading(text):
                    current_heading = text
        else:
            # Context line — if we have accumulated changes, flush them
            if current_removed or current_added:
                sections.append(_make_section(current_heading, current_removed, current_added))
                current_removed = []
                current_added = []

            # Context lines might be headings for the next section
            text = line.strip()
            if _looks_like_heading(text):
                current_heading = text

    # Flush final section
    if current_removed or current_added:
        sections.append(_make_section(current_heading, current_removed, current_added))

    return sections


def _make_section(heading: str, removed: list[str], added: list[str]) -> DiffSection:
    """Create a DiffSection from accumulated changes."""
    if removed and not added:
        return DiffSection(
            heading=heading,
            old_text="\n".join(removed),
            change_type="removed",
        )
    elif added and not removed:
        return DiffSection(
            heading=heading,
            new_text="\n".join(added),
            change_type="added",
        )
    else:
        return DiffSection(
            heading=heading,
            old_text="\n".join(removed),
            new_text="\n".join(added),
            change_type="modified",
        )


def _looks_like_heading(text: str) -> bool:
    """Heuristic: does this look like a section heading?"""
    if not text:
        return False
    # All caps, or short and title-case, or numbered
    if text.isupper() and len(text) < 100:
        return True
    if re.match(r"^\d+\.\s+\w", text) and len(text) < 120:
        return True
    if text.istitle() and len(text.split()) <= 8:
        return True
    return False


def _generate_html_diff(old_lines: list[str], new_lines: list[str]) -> str:
    """Generate an HTML table diff (like GitHub's side-by-side view)."""
    differ = difflib.HtmlDiff(wrapcolumn=80)
    try:
        return differ.make_table(
            old_lines[:500],  # Limit to prevent huge diffs
            new_lines[:500],
            fromdesc="Previous",
            todesc="Current",
            context=True,
            numlines=3,
        )
    except Exception:
        # Fallback: simple inline diff
        diff = difflib.unified_diff(old_lines[:500], new_lines[:500], lineterm="")
        html_lines = []
        for line in diff:
            if line.startswith("+") and not line.startswith("+++"):
                html_lines.append(f'<span class="diff-added">{_escape(line)}</span>')
            elif line.startswith("-") and not line.startswith("---"):
                html_lines.append(f'<span class="diff-removed">{_escape(line)}</span>')
            else:
                html_lines.append(f"<span>{_escape(line)}</span>")
        return "<pre>" + "\n".join(html_lines) + "</pre>"


def _escape(text: str) -> str:
    """HTML-escape special characters."""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
