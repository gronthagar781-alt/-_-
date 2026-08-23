#!/usr/bin/env python3
"""
Auto-update Current Affairs from kolom.in

Fetches daily current-affairs MCQs from https://www.kolom.in/
(Bengali, competitive-exam style) and injects them into the website's
HTML file's `CURRENT_AFFAIRS` JavaScript variable.

Designed for GitHub Actions — runs daily and commits changes automatically.
Also performs a one-year backfill on the first run (or whenever the stored
data has fewer than ~60 days of content).

Sources:
  - Website : https://www.kolom.in/  (Blogger blog)
  - Telegram: https://t.me/kolomin   (links back to kolom.in posts)

 kolom.in post HTML structure (per question):
   <b>N.প্রশ্ন?</b><br />
   opt1<br />
   opt2<br />
   opt3<br />
   opt4<br />
   <div id="spoilerN" ...> উত্তর:: সঠিক_উত্তর </div>

The Blogger JSON feed (feeds/posts/default?alt=json) gives us the raw HTML
content of each post, which we parse into MCQ dicts.
"""

import re
import json
import urllib.request
import urllib.error
import urllib.parse
import sys
import os
import html as html_mod
from datetime import datetime, timedelta

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SITE_BASE = "https://www.kolom.in"
BLOG_FEED = SITE_BASE + "/feeds/posts/default"
# The label/category used on kolom.in for daily current-affairs posts
FEED_LABEL = "Daily Current Affairs"
ONE_YEAR_DAYS = 365
FEED_PAGE_SIZE = 150          # Blogger allows up to 150 per page
MAX_FEED_PAGES = 6            # 6 × 150 = 900 posts cap (more than 1 year daily)
REQUEST_TIMEOUT = 30
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

# Bengali <-> English digits
BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")

BN_MONTHS = {
    "জানুয়ারি": "January", "ফেব্রুয়ারি": "February", "মার্চ": "March",
    "এপ্রিল": "April", "মে": "May", "জুন": "June",
    "জুলাই": "July", "আগস্ট": "August", "আগষ্ট": "August",
    "সেপ্টেম্বর": "September", "অক্টোবর": "October",
    "নভেম্বর": "November", "ডিসেম্বর": "December",
}


# ---------------------------------------------------------------------------
# Networking
# ---------------------------------------------------------------------------
def fetch_url(url):
    """Fetch URL content with a desktop User-Agent."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            data = resp.read()
            try:
                return data.decode("utf-8")
            except UnicodeDecodeError:
                return data.decode("utf-8", errors="replace")
    except Exception as e:
        print(f"  [warn] fetch failed {url}: {e}")
        return ""


def fetch_json(url):
    """Fetch and parse a JSON URL. Returns None on failure."""
    raw = fetch_url(url)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception as e:
        print(f"  [warn] JSON parse failed: {e}")
        return None


# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------
def normalize_date_to_en(date_str):
    """Convert a date string to 'DD Month YYYY' English form."""
    if not date_str:
        return ""
    s = date_str.translate(BN_DIGITS).strip()
    s = re.sub(r"\s+", " ", s)

    # English month name: 23 August 2026 / 23 August, 2026
    m = re.search(r"(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})", s)
    if m:
        day, mon, yr = m.group(1), m.group(2).capitalize(), m.group(3)
        return f"{int(day)} {mon} {yr}"

    # Bengali month: 23শে আগস্ট 2026 / 23 আগস্ট 2026
    m = re.search(
        r"(\d{1,2})(?:st|nd|rd|th|শে|লা|র্থ|ই|তম)?\s+([\u0980-\u09ff]+),?\s+(\d{4})",
        s,
    )
    if m:
        day, mon_bn, yr = m.group(1), m.group(2), m.group(3)
        month_en = BN_MONTHS.get(mon_bn)
        if month_en:
            return f"{int(day)} {month_en} {yr}"

    return date_str.strip()


def date_to_iso(date_str):
    """Convert 'DD Month YYYY' to 'YYYY-MM-DD'. Returns '' on failure."""
    try:
        dt = datetime.strptime(date_str, "%d %B %Y")
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return ""


def today_en_str():
    return datetime.now().strftime("%-d %B %Y")


def iso_from_published(published_str):
    """Parse Blogger 'published' field '2026-08-23T09:05:18.136+05:30' → 'YYYY-MM-DD'."""
    try:
        return published_str[:10]
    except Exception:
        return ""


def iso_to_en_date(iso_str):
    """'2026-08-23' → '23 August 2026'."""
    try:
        dt = datetime.strptime(iso_str, "%Y-%m-%d")
        return dt.strftime("%-d %B %Y")
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# HTML → text conversion
# ---------------------------------------------------------------------------
def html_to_lines(html_content):
    """Convert kolom.in post HTML to plain-text lines.

    Each <br>, </div>, </b>, <hr>, </button>, </p> becomes a newline.
    All other tags are stripped. HTML entities are unescaped.
    """
    text = html_content
    # Remove <span...> and </span> (no break, just inline formatting)
    text = re.sub(r"<span[^>]*>", "", text)
    text = re.sub(r"</span>", "", text)
    # Convert break-inducing tags to newlines
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</div>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</b>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</button>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<hr[^>]*/?>", "\n---\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</li>", "\n", text, flags=re.IGNORECASE)
    # Strip all remaining tags
    text = re.sub(r"<[^>]+>", "", text)
    # Unescape HTML entities
    text = html_mod.unescape(text)
    # Split into lines, strip each
    lines = [ln.strip() for ln in text.split("\n")]
    # Remove empty lines and navigation noise
    cleaned = []
    for ln in lines:
        if not ln:
            continue
        # Skip navigation / boilerplate
        if ln in ("---", "► উত্তর দেখুন", "কলম ✏", "সুপ্রিয় বন্ধুরা,"):
            continue
        if ln.startswith("❮") or ln.startswith("❯"):
            continue
        if ln.startswith("Copyright ©"):
            continue
        cleaned.append(ln)
    return cleaned


# ---------------------------------------------------------------------------
# Parse MCQs from kolom.in lines
# ---------------------------------------------------------------------------
QUESTION_START_RE = re.compile(r"^(\d+)[\.\)]\s*(.+)")


def parse_lines(lines, date_str):
    """Parse cleaned text lines into MCQ dicts.

    Expected structure (after html_to_lines):
        1. প্রশ্ন?
        opt1
        opt2
        opt3
        opt4
        উত্তর:: সঠিক_উত্তর  (possibly extra explanation on same/next line)

    Returns list of MCQ dicts.
    """
    mcqs = []
    date_en = normalize_date_to_en(date_str)
    i = 0
    n = len(lines)

    while i < n:
        line = lines[i]
        m = QUESTION_START_RE.match(line)
        if not m:
            i += 1
            continue

        question = m.group(2).strip().rstrip("?:-").strip()
        if question and not question.endswith("?"):
            question += "?"

        # Collect subsequent lines until the next question or end
        # Look for the answer line and option lines
        options = []
        answer_text = None
        j = i + 1
        while j < n:
            nxt = lines[j]
            # If we hit the next question, stop
            if QUESTION_START_RE.match(nxt):
                break
            # Answer line?
            am = re.match(r"উত্তর\s*::?\s*(.+)", nxt)
            if am:
                answer_text = am.group(1).strip()
                j += 1
                continue
            # Skip explanation continuation (lines after the answer that
            # aren't options — e.g. theme text). We stop collecting options
            # once we've found the answer.
            if answer_text is not None:
                # could be explanation continuation; skip
                j += 1
                continue
            # It's an option line (not a question, not an answer)
            options.append(nxt)
            j += 1

        # We need exactly 4 options
        if len(options) < 4 or not answer_text:
            i += 1
            continue

        # Take the first 4 options (in case extras were captured)
        opts = options[:4]
        opts = [re.sub(r"\s+", " ", o).strip(" .।") for o in opts]

        answer = match_answer(answer_text, opts)
        if answer is None:
            answer = "A"  # fallback; shouldn't happen often

        mcqs.append({
            "question": question,
            "options": {"A": opts[0], "B": opts[1], "C": opts[2], "D": opts[3]},
            "answer": answer,
            "date": date_en,
            "source": "kolom.in",
        })

        i = j

    return mcqs


def match_answer(answer_text, options):
    """Map the answer text (Bengali/English) to A/B/C/D."""
    a = answer_text.translate(BN_DIGITS).strip().strip(".।")
    # Exact match
    for letter, opt in zip("ABCD", options):
        o = opt.translate(BN_DIGITS).strip().strip(".।")
        if a == o:
            return letter
    # Option contained in answer (answer may have trailing particles like "-তে", "-এর")
    for letter, opt in zip("ABCD", options):
        o = opt.translate(BN_DIGITS).strip().strip(".।")
        if len(o) >= 3 and o in a:
            return letter
    # Answer contained in option
    for letter, opt in zip("ABCD", options):
        o = opt.translate(BN_DIGITS).strip().strip(".।")
        if len(a) >= 3 and a in o:
            return letter
    # Last resort: check if answer starts with an option
    for letter, opt in zip("ABCD", options):
        o = opt.translate(BN_DIGITS).strip().strip(".।")
        if a.startswith(o):
            return letter
    return None


def parse_post_html(html_content, date_str):
    """Full pipeline: HTML → lines → MCQs."""
    lines = html_to_lines(html_content)
    return parse_lines(lines, date_str)


# ---------------------------------------------------------------------------
# Fetching posts from the Blogger feed
# ---------------------------------------------------------------------------
def fetch_feed_page(label, start_index=1, max_results=FEED_PAGE_SIZE):
    """Fetch one page of the Blogger JSON feed.

    Returns (entries, next_start_index_or_None).
    """
    params = f"?alt=json&max-results={max_results}&start-index={start_index}"
    if label:
        # URL-encode the label for the path
        encoded = urllib.parse.quote(label)
        url = f"{BLOG_FEED}/-/{encoded}{params}"
    else:
        url = f"{BLOG_FEED}{params}"

    print(f"  Fetching feed page (start={start_index})...")
    data = fetch_json(url)
    if not data:
        return [], None

    feed = data.get("feed", {})
    entries = feed.get("entry", [])
    if not entries:
        return [], None

    total = int(feed.get("openSearch$totalResults", {}).get("$t", 0))
    next_start = start_index + len(entries)
    next_start_index = next_start if next_start <= total else None

    return entries, next_start_index


def extract_posts_from_feed(entries, cutoff_iso):
    """Extract (date_en, html_content, title) from feed entries, filtered by cutoff."""
    posts = []
    for e in entries:
        # Only current-affairs posts (by category or title)
        categories = [c.get("term", "") for c in e.get("category", [])]
        title = e.get("title", {}).get("$t", "")
        is_ca = (
            "current affairs" in title.lower()
            or "Daily Current Affairs" in categories
            or "Current Affairs" in categories
        )
        if not is_ca:
            continue

        published = e.get("published", {}).get("$t", "")
        iso = iso_from_published(published)
        if iso and iso < cutoff_iso:
            continue

        content = e.get("content", {}).get("$t") or e.get("summary", {}).get("$t", "")
        if not content:
            continue

        date_en = iso_to_en_date(iso) if iso else ""
        posts.append((date_en, content, title))
    return posts


# ---------------------------------------------------------------------------
# HTML file update
# ---------------------------------------------------------------------------
def update_html_file(html_path, new_ca_data):
    """Update the CURRENT_AFFAIRS variable in the HTML file."""
    if not os.path.exists(html_path):
        print(f"ERROR: HTML file not found: {html_path}")
        return False

    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()

    marker = "const CURRENT_AFFAIRS="
    start_idx = content.find(marker)
    if start_idx == -1:
        print("ERROR: CURRENT_AFFAIRS not found in HTML file")
        return False

    json_start = start_idx + len(marker)
    end_idx = content.find(";\n", json_start)
    if end_idx == -1:
        end_idx = content.find(";", json_start)

    old_json = content[json_start:end_idx]
    try:
        old_data = json.loads(old_json)
    except Exception:
        old_data = []

    # Merge: dedup by (question, date)
    merged = []
    seen = set()

    def key_of(m):
        q = (m.get("question") or "")[:60].strip()
        return (q, m.get("date", ""))

    for mcq in new_ca_data + old_data:
        k = key_of(mcq)
        if k in seen:
            continue
        seen.add(k)
        merged.append(mcq)

    # Keep only the last 1 year
    cutoff_iso = (datetime.now() - timedelta(days=ONE_YEAR_DAYS)).strftime("%Y-%m-%d")
    kept = []
    for m in merged:
        iso = date_to_iso(m.get("date", ""))
        if iso and iso < cutoff_iso:
            continue
        kept.append(m)

    # Sort newest first
    kept.sort(key=lambda m: date_to_iso(m.get("date", "")) or "0", reverse=True)

    new_json = json.dumps(kept, ensure_ascii=False)
    if "\n" in new_json:
        print("ERROR: raw newlines in JSON, aborting")
        return False

    new_content = content[:json_start] + new_json + content[end_idx:]
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(new_content)

    print(f"Updated CURRENT_AFFAIRS: {len(old_data)} -> {len(kept)} MCQs")
    return True


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def find_html_file():
    candidates = []
    for root, dirs, files in os.walk("."):
        if ".git" in root:
            continue
        for f in files:
            if f.endswith(".html"):
                if f == "index.html" or "panchayat" in f.lower() or "website" in f.lower():
                    candidates.append(os.path.join(root, f))
    for c in candidates:
        if os.path.basename(c) == "index.html":
            return c
    return candidates[0] if candidates else None


def main():
    html_path = find_html_file()
    if not html_path:
        print("ERROR: No HTML file found!")
        sys.exit(1)
    print(f"HTML file: {html_path}")

    cutoff_iso = (datetime.now() - timedelta(days=ONE_YEAR_DAYS)).strftime("%Y-%m-%d")
    print(f"Backfill cutoff: {cutoff_iso} (last {ONE_YEAR_DAYS} days)")

    all_mcqs = []
    start_index = 1
    total_posts = 0

    for page in range(MAX_FEED_PAGES):
        entries, next_start = fetch_feed_page(FEED_LABEL, start_index=start_index)
        if not entries:
            # Fallback: try the general feed without label
            if page == 0:
                print("  Label feed empty, trying general feed...")
                entries, next_start = fetch_feed_page(None, start_index=start_index)
            if not entries:
                break

        posts = extract_posts_from_feed(entries, cutoff_iso)
        print(f"  Page {page+1}: {len(entries)} entries, {len(posts)} current-affairs posts")

        for date_en, content_html, title in posts:
            mcqs = parse_post_html(content_html, date_en or today_en_str())
            if mcqs:
                print(f"    [{date_en}] {title[:50]}: {len(mcqs)} MCQs")
            all_mcqs.extend(mcqs)

        total_posts += len(posts)

        if next_start is None:
            print("  No more feed pages.")
            break
        start_index = next_start

    print(f"\nTotal posts parsed: {total_posts}")
    print(f"Total MCQs fetched: {len(all_mcqs)}")

    # Dedup within new data
    seen = set()
    unique_new = []
    for m in all_mcqs:
        k = (m.get("question", "")[:60].strip(), m.get("date", ""))
        if k in seen:
            continue
        seen.add(k)
        unique_new.append(m)

    print(f"Unique new MCQs: {len(unique_new)}")
    if not unique_new:
        print("No new current affairs found. Exiting.")
        sys.exit(0)

    success = update_html_file(html_path, unique_new)
    if success:
        print("\n✅ Current affairs updated successfully!")
        sys.exit(0)
    else:
        print("\n❌ Failed to update current affairs.")
        sys.exit(1)


if __name__ == "__main__":
    main()
