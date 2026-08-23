#!/usr/bin/env python3
"""
Auto-update Current Affairs from songkolpa.com
This script fetches daily current affairs MCQs from songkolpa.com
and injects them into the HTML file's CURRENT_AFFAIRS variable.

Designed for GitHub Actions - runs daily and commits changes automatically.
"""

import re
import json
import urllib.request
import urllib.error
import sys
import os
from datetime import datetime, timedelta

def fetch_url(url):
    """Fetch URL content with proper headers"""
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return ""

def parse_current_affairs(text, date_str):
    """Parse current affairs MCQs from page text.
    Handles two formats:
    1. A) opt B) opt C) opt D) opt + উত্তর: X)
    2. (ক) opt (খ) opt (গ) opt (ঘ) opt
    """
    mcqs = []
    bengali_to_eng = {'ক': 'A', 'খ': 'B', 'গ': 'C', 'ঘ': 'D'}

    # Pattern 1: number. question A) opt B) opt C) opt D) opt \n উত্তর: X)
    # Handle both Bengali and English numerals
    pattern1 = re.compile(
        r'[১২৩৪৫৬৭৮৯০\d]+[\.\)]\s*(.+?)\s*A\)\s*(.+?)\s*B\)\s*(.+?)\s*C\)\s*(.+?)\s*D\)\s*(.+?)(?:\n|$)'
    )

    lines = text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        m = pattern1.match(line)
        if m:
            q = m.group(1).strip()
            opts = {
                'A': m.group(2).strip(),
                'B': m.group(3).strip(),
                'C': m.group(4).strip(),
                'D': m.group(5).strip().rstrip('.')
            }
            # Look for answer in next line(s)
            answer = 'A'
            for j in range(i+1, min(i+4, len(lines))):
                ans_line = lines[j].strip()
                if 'উত্তর' in ans_line or '✅' in ans_line:
                    ans_m = re.search(r'([A-D])\)', ans_line)
                    if ans_m:
                        answer = ans_m.group(1)
                        break
            mcqs.append({
                'question': q,
                'options': opts,
                'answer': answer,
                'date': date_str,
                'source': 'songkolpa.com'
            })
            i += 1
            continue

        # Pattern 2: (ক) opt (খ) opt (গ) opt (ঘ) opt
        m2 = re.match(
            r'[১২৩৪৫৬৭৮৯০\d]+[।.]\s*(.+?)\s*\(ক\)\s*(.+?)\s*\(খ\)\s*(.+?)\s*\(গ\)\s*(.+?)\s*\(ঘ\)\s*(.+)',
            line
        )
        if m2:
            q = m2.group(1).strip()
            opts = {
                'A': m2.group(2).strip().rstrip('।.'),
                'B': m2.group(3).strip().rstrip('।.'),
                'C': m2.group(4).strip().rstrip('।.'),
                'D': m2.group(5).strip().rstrip('।.')
            }
            # Look for answer
            answer = 'A'
            for j in range(i+1, min(i+4, len(lines))):
                ans_line = lines[j].strip()
                if 'উত্তর' in ans_line:
                    for bn, en in bengali_to_eng.items():
                        if f'({bn})' in ans_line:
                            answer = en
                            break
                    break
            mcqs.append({
                'question': q,
                'options': opts,
                'answer': answer,
                'date': date_str,
                'source': 'songkolpa.com'
            })
            i += 1
            continue

        i += 1

    return mcqs

def parse_gk_notes(text, date_str):
    """Parse GK Short Notes (Q&A format) and convert to MCQs"""
    import random
    random.seed(42)

    pairs = []
    for line in text.split('\n'):
        line = line.strip()
        if not line:
            continue
        m = re.match(r'[১২৩৪৫৬৭৮৯০\d]+[\)]\s*(.+?)\s*[-–—]\s*(.+)', line)
        if m:
            q = m.group(1).strip().rstrip('?।.')
            a = m.group(2).strip().rstrip('।.')
            if len(q) > 5 and len(a) > 1:
                pairs.append((q + '?', a))

    if len(pairs) < 4:
        return []

    all_answers = [p[1] for p in pairs]
    mcqs = []
    for i, (q, correct) in enumerate(pairs):
        others = [a for j, a in enumerate(all_answers) if j != i and a != correct]
        if len(others) < 3:
            continue
        distractors = random.sample(others, 3)
        options = distractors + [correct]
        random.shuffle(options)
        if len(set(options)) < 4:
            continue
        letters = ['A', 'B', 'C', 'D']
        answer = letters[options.index(correct)]
        mcqs.append({
            'question': q,
            'options': {letters[j]: opt for j, opt in enumerate(options)},
            'answer': answer,
            'date': date_str,
            'source': 'songkolpa.com - GK Short Note'
        })

    return mcqs

def extract_date_from_content(text):
    """Extract the date from a current affairs post"""
    # Look for patterns like "22nd August 2026" or "22শে আগস্ট ২০২৬"
    m = re.search(r'(\d+)(?:st|nd|rd|th)?\s+(\w+)\s+2026', text)
    if m:
        day = m.group(1)
        month = m.group(2)
        return f"{day} {month} 2026"

    # Bengali date pattern
    bengali_months = {
        'জানুয়ারি': 'January', 'ফেব্রুয়ারি': 'February', 'মার্চ': 'March',
        'এপ্রিল': 'April', 'মে': 'May', 'জুন': 'June',
        'জুলাই': 'July', 'আগস্ট': 'August', 'সেপ্টেম্বর': 'September',
        'অক্টোবর': 'October', 'নভেম্বর': 'November', 'ডিসেম্বর': 'December'
    }
    m2 = re.search(r'(\d+)[শেলা]*\s*(\w+)\s*২০২৬', text)
    if m2:
        day = m2.group(1)
        month_bn = m2.group(2)
        month_en = bengali_months.get(month_bn, month_bn)
        return f"{day} {month_en} 2026"

    return datetime.now().strftime("%-d %B %Y")

def fetch_recent_current_affairs():
    """Fetch current affairs from songkolpa.com for recent dates"""
    all_mcqs = []

    # Fetch the main page (has latest posts)
    print("Fetching songkolpa.com main page...")
    main_text = fetch_url("https://www.songkolpa.com/?m=1")
    if not main_text:
        print("WARNING: Could not fetch main page")
    else:
        today_str = datetime.now().strftime("%-d %B %Y")
        today_mcqs = parse_current_affairs(main_text, today_str)
        gk_mcqs = parse_gk_notes(main_text, today_str)
        all_mcqs.extend(today_mcqs)
        all_mcqs.extend(gk_mcqs)
        print(f"  Found {len(today_mcqs)} CA MCQs and {len(gk_mcqs)} GK MCQs from main page")

    # Also fetch the search label page for more posts
    print("Fetching current affairs label page...")
    label_text = fetch_url("https://www.songkolpa.com/search/label/current%20affairs%20songkolpa?max-results=50")
    if label_text:
        # Extract dates and parse each section
        # Find all "Daily Current Affairs" headers
        sections = re.split(r'## (Daily Current Affairs[^\n]*)', label_text)
        for i in range(1, len(sections), 2):
            if i + 1 < len(sections):
                header = sections[i]
                content = sections[i + 1]
                date_str = extract_date_from_content(header + content)
                mcqs = parse_current_affairs(content, date_str)
                if mcqs:
                    all_mcqs.extend(mcqs)
                    print(f"  Found {len(mcqs)} MCQs for {date_str}")

    # Deduplicate by question text
    seen = set()
    unique_mcqs = []
    for mcq in all_mcqs:
        q_key = mcq['question'][:50].strip()
        if q_key not in seen:
            seen.add(q_key)
            unique_mcqs.append(mcq)

    print(f"\nTotal unique MCQs: {len(unique_mcqs)}")
    return unique_mcqs

def update_html_file(html_path, new_ca_data):
    """Update the CURRENT_AFFAIRS variable in the HTML file"""
    if not os.path.exists(html_path):
        print(f"ERROR: HTML file not found: {html_path}")
        return False

    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the CURRENT_AFFAIRS variable
    marker = 'const CURRENT_AFFAIRS='
    start_idx = content.find(marker)
    if start_idx == -1:
        print("ERROR: CURRENT_AFFAIRS not found in HTML file")
        return False

    # Find the end of the JSON (next ;\n)
    json_start = start_idx + len(marker)
    end_idx = content.find(';\n', json_start)
    if end_idx == -1:
        end_idx = content.find(';', json_start)

    old_json = content[json_start:end_idx]

    # Try to parse old data and merge
    try:
        old_data = json.loads(old_json)
    except:
        old_data = []

    # Merge: keep old MCQs that aren't in new data, add new ones
    existing_dates = set(m.get('date', '') for m in new_ca_data)
    merged = []
    seen_dates = set()

    for mcq in new_ca_data:
        merged.append(mcq)
        seen_dates.add(mcq.get('date', ''))

    for mcq in old_data:
        date = mcq.get('date', '')
        if date not in seen_dates:
            merged.append(mcq)
            seen_dates.add(date)

    # Sort by date (newest first)
    merged.sort(key=lambda m: m.get('date', ''), reverse=True)

    new_json = json.dumps(merged, ensure_ascii=False)

    # Verify no raw newlines
    if '\n' in new_json:
        print("ERROR: Raw newlines in JSON!")
        return False

    # Replace in content
    new_content = content[:json_start] + new_json + content[end_idx:]

    # Write back
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"Updated CURRENT_AFFAIRS: {len(old_data)} -> {len(merged)} MCQs")
    return True

def main():
    # Find HTML file
    html_path = None
    for name in os.listdir('.'):
        if name.endswith('.html') and 'panchayat' in name.lower():
            html_path = name
            break
        if name.endswith('.html') and 'website' in name.lower():
            html_path = name
            break
        if name == 'index.html':
            html_path = name
            break

    if not html_path:
        # Check subdirectories
        for root, dirs, files in os.walk('.'):
            for f in files:
                if f.endswith('.html') and ('panchayat' in f.lower() or 'website' in f.lower() or f == 'index.html'):
                    html_path = os.path.join(root, f)
                    break
            if html_path:
                break

    if not html_path:
        print("ERROR: No HTML file found!")
        sys.exit(1)

    print(f"HTML file: {html_path}")

    # Fetch new current affairs
    new_ca = fetch_recent_current_affairs()

    if not new_ca:
        print("No new current affairs found. Exiting.")
        sys.exit(0)

    # Update HTML file
    success = update_html_file(html_path, new_ca)

    if success:
        print("\n✅ Current affairs updated successfully!")
        sys.exit(0)
    else:
        print("\n❌ Failed to update current affairs.")
        sys.exit(1)

if __name__ == '__main__':
    main()
