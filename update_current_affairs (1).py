#!/usr/bin/env python3
"""
Auto-update Current Affairs from kolom.in

Fetches daily current-affairs posts from kolom.in via the Blogger JSON feed
and stores them as NOTE entries (not MCQs) in the website's CURRENT_AFFAIRS
JavaScript variable.

Sources:
  - kolom.in (Blogger blog, blog ID 7030558168974148609)
  - Telegram channel t.me/kolomin (links back to kolom.in posts)

Each note entry:
  {
    "title":   "The question/statement text",
    "answer":  "The correct answer",
    "detail":  "Extra explanation (theme, context, etc.)",
    "date":    "23 August 2026",
    "source":  "kolom.in"
  }

Designed for GitHub Actions — runs daily at 6:30 AM IST.
Also backfills the last 1 year (365 days) of posts.
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
BLOG_ID = "7030558168974148609"
FEED_LABEL = "Daily Current Affairs"
# Use blogger.com directly — the kolom.in label feed returns 0 results
FEED_BASE = f"https://www.blogger.com/feeds/{BLOG_ID}/posts/default/-/{urllib.parse.quote(FEED_LABEL)}"
FALLBACK_FEED = f"https://www.blogger.com/feeds/{BLOG_ID}/posts/default"
SITE_BASE = "https://www.kolom.in"
ONE_YEAR_DAYS = 365
FEED_PAGE_SIZE = 150
MAX_FEED_PAGES = 8  # 8 × 150 = 1200 posts (more than 1 year of daily posts)
REQUEST_TIMEOUT = 30
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

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
    if not date_str:
        return ""
    s = date_str.translate(BN_DIGITS).strip()
    s = re.sub(r"\s+", " ", s)
    m = re.search(r"(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})", s)
    if m:
        return f"{int(m.group(1))} {m.group(2).capitalize()} {m.group(3)}"
    m = re.search(
        r"(\d{1,2})(?:st|nd|rd|th|শে|লা|র্থ|ই|তম)?\s+([\u0980-\u09ff]+),?\s+(\d{4})", s
    )
    if m:
        month_en = BN_MONTHS.get(m.group(2))
        if month_en:
            return f"{int(m.group(1))} {month_en} {m.group(3)}"
    return date_str.strip()


def date_to_iso(date_str):
    try:
        return datetime.strptime(date_str, "%d %B %Y").strftime("%Y-%m-%d")
    except Exception:
        return ""


def iso_to_en_date(iso_str):
    try:
        return datetime.strptime(iso_str, "%Y-%m-%d").strftime("%-d %B %Y")
    except Exception:
        return ""


def iso_from_published(published_str):
    try:
        return published_str[:10]
    except Exception:
        return ""


def today_en_str():
    return datetime.now().strftime("%-d %B %Y")


# ---------------------------------------------------------------------------
# HTML → structured notes
# ---------------------------------------------------------------------------
def html_to_notes(html_content, date_str):
    """Parse kolom.in post HTML into a list of note dicts.

    Each note: {title, answer, detail, date, source}

    HTML structure per question:
      <b>N. question text (may span lines)</b><br />
      opt1<br />
      opt2<br />
      opt3<br />
      opt4<br />
      <div id="spoilerN" ...> উত্তর:: answer_text </div>
    """
    date_en = normalize_date_to_en(date_str) or today_en_str()
    notes = []

    # Strategy: split the HTML by <hr> tags to get individual question blocks
    # Each question block has a <b>N. ...</b> and a উত্তর:: line
    blocks = re.split(r"<hr[^>]*/?>", html_content, flags=re.IGNORECASE)

    for block in blocks:
        # Check if this block has a question (starts with <b>N.)
        # The <b> tag may contain \n, so we need to handle multiline
        bmatch = re.search(
            r"<b[^>]*>\s*(\d+)[\.\)]\s*(.+?)</b>",
            block,
            re.DOTALL | re.IGNORECASE,
        )
        if not bmatch:
            continue

        question_raw = bmatch.group(2)
        # Clean: remove tags, unescape, collapse whitespace/newlines
        question_raw = re.sub(r"<[^>]+>", " ", question_raw)
        question_raw = html_mod.unescape(question_raw)
        question_raw = re.sub(r"\s+", " ", question_raw).strip()
        # Remove trailing ? if present (we'll add it back for consistency)
        question = question_raw.rstrip("?:-").strip()
        if not question:
            continue

        # Find the answer — capture everything inside the spoiler div,
        # then clean HTML tags (including <br>) into spaces
        # The spoiler div contains: উত্তর:: answer_text <br/> optional_explanation
        spoiler_match = re.search(
            r"উত্তর\s*::?\s*(.+?)\s*</span>",
            block,
            re.DOTALL | re.IGNORECASE,
        )
        if not spoiler_match:
            # Fallback: simpler pattern
            spoiler_match = re.search(
                r"উত্তর\s*::?\s*(.+)",
                block,
                re.DOTALL | re.IGNORECASE,
            )
            if not spoiler_match:
                continue

        answer_raw = spoiler_match.group(1)
        # Convert <br> tags to spaces, strip all other tags, unescape entities
        answer_raw = re.sub(r"<br\s*/?>", " ", answer_raw, flags=re.IGNORECASE)
        answer_raw = re.sub(r"<[^>]+>", " ", answer_raw)
        answer_raw = html_mod.unescape(answer_raw)
        answer_raw = re.sub(r"\s+", " ", answer_raw).strip()

        # Split answer from detail/explanation
        answer = answer_raw
        detail = ""

        # Try separator-based split first
        for sep in ["। ", " - ", " — ", ". "]:
            idx = answer_raw.find(sep)
            if idx > 0 and idx < len(answer_raw) - 3:
                answer = answer_raw[:idx].strip()
                detail = answer_raw[idx + len(sep):].strip()
                break

        # If the answer is still very long, try matching against the options
        # to extract just the short answer
        if len(answer) > 30 and not detail:
            opts_section = block[bmatch.end():]
            opts_text = re.sub(r"<[^>]+>", "\n", opts_section)
            opts_text = html_mod.unescape(opts_text)
            opt_lines = [
                l.strip() for l in opts_text.split("\n")
                if l.strip()
                and not l.strip().startswith("উত্তর")
                and not l.strip().startswith("►")
            ]
            for opt in opt_lines[:6]:
                # Match against original (non-translated) text, but use
                # translated comparison for robustness
                opt_orig = opt.strip().strip(".।")
                opt_trans = opt_orig.translate(BN_DIGITS)
                ans_trans = answer.translate(BN_DIGITS)
                if len(opt_orig) >= 2 and opt_trans in ans_trans:
                    answer = opt_orig
                    detail = answer_raw
                    break

        notes.append({
            "title": question,
            "answer": answer,
            "detail": detail,
            "date": date_en,
            "source": "kolom.in",
        })

    return notes


# ---------------------------------------------------------------------------
# Feed fetching with pagination
# ---------------------------------------------------------------------------
def fetch_feed_page(start_index=1, max_results=FEED_PAGE_SIZE):
    """Fetch one page of the Blogger JSON feed. Returns (entries, next_start_or_None)."""
    url = f"{FEED_BASE}?alt=json&max-results={max_results}&start-index={start_index}"
    print(f"  Fetching feed page (start={start_index}, url={url[:80]}...)...")
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
    print(f"    Got {len(entries)} entries (total available: {total})")
    return entries, next_start_index


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

    # Merge: dedup by (title, date)
    merged = []
    seen = set()

    def key_of(m):
        t = (m.get("title") or m.get("question") or "")[:80].strip()
        return (t, m.get("date", ""))

    for note in new_ca_data + old_data:
        k = key_of(note)
        if k in seen:
            continue
        seen.add(k)
        merged.append(note)

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

    print(f"Updated CURRENT_AFFAIRS: {len(old_data)} -> {len(kept)} entries")
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

    all_notes = []
    start_index = 1
    total_posts = 0

    for page in range(MAX_FEED_PAGES):
        entries, next_start = fetch_feed_page(start_index=start_index)
        if not entries:
            # Fallback: try general feed without label
            if page == 0:
                print("  Label feed empty, trying general feed...")
                url = f"{FALLBACK_FEED}?alt=json&max-results={FEED_PAGE_SIZE}&start-index={start_index}"
                print(f"  Fetching general feed (start={start_index})...")
                data = fetch_json(url)
                if data:
                    entries = data.get("feed", {}).get("entry", [])
            if not entries:
                break

        posts_this_page = 0
        for e in entries:
            # Only current-affairs posts
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
            notes = html_to_notes(content, date_en or today_en_str())
            if notes:
                print(f"    [{date_en}] {title[:50]}: {len(notes)} notes")
            all_notes.extend(notes)
            posts_this_page += 1

        total_posts += posts_this_page
        print(f"  Page {page+1}: {len(entries)} entries, {posts_this_page} CA posts")

        if next_start is None:
            print("  No more feed pages.")
            break
        start_index = next_start

    print(f"\nTotal CA posts parsed: {total_posts}")
    print(f"Total notes fetched: {len(all_notes)}")

    # Dedup
    seen = set()
    unique = []
    for n in all_notes:
        k = (n.get("title", "")[:80].strip(), n.get("date", ""))
        if k in seen:
            continue
        seen.add(k)
        unique.append(n)

    print(f"Unique notes: {len(unique)}")
    if not unique:
        print("No current affairs found. Exiting.")
        sys.exit(0)

    success = update_html_file(html_path, unique)
    if success:
        print("\n✅ Current affairs updated successfully!")
        sys.exit(0)
    else:
        print("\n❌ Failed to update current affairs.")
        sys.exit(1)


if __name__ == "__main__":
    main()
