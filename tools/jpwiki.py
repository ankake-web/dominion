"""日本語wiki（wikiwiki.jp/dominiondeck）を読む＝カード日本語名・日本語カードテキストの正本。

使い方:  python jpwiki.py <ページ名> [<ページ名> ...]
  例:    python jpwiki.py "略奪（拡張）" セイレーン 略奪品

ポイント:
 - 英語wiki の "Other language versions" の Japanese 行は当てにならない（夜想曲では17枚で実物と食い違った）。
   **日本語名・日本語文面はこのサイトが正本**（ホビージャパン印刷版準拠）。
 - ページ名は日本語そのまま渡してよい（URLエンコードはこちらでやる）。
 - 出力は UTF-8。編集用リンク・コメント欄・サイドバーは落としてある。
"""
import re, sys, html, io, urllib.request, urllib.parse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE = 'https://wikiwiki.jp/dominiondeck/'


def fetch(page):
    url = BASE + urllib.parse.quote(page)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0',
                                               'Accept-Encoding': 'identity'})
    with urllib.request.urlopen(req, timeout=90) as r:
        raw = r.read()
    if raw[:2] == b'\x1f\x8b':
        import gzip
        raw = gzip.decompress(raw)
    return raw.decode('utf-8', 'replace')


def strip(s):
    # 本文だけ残す（サイドバー・ヘッダ・フッタを落とす）
    m = re.search(r'(?s)<div[^>]+id="body"[^>]*>(.*)', s)
    if m:
        s = m.group(1)
    s = re.sub(r'(?s)<(script|style|nav|footer).*?</\1>', '', s)
    s = re.sub(r'(?s)<div[^>]+class="[^"]*(?:sidebar|menubar|comment-form)[^"]*".*?</div>', '', s)
    s = re.sub(r'(?s)<[^>]+>', '\n', s)
    t = html.unescape(s)
    t = re.sub(r'[ \t\xa0]+', ' ', t)
    t = re.sub(r'\n[ ]*', '\n', t)
    t = re.sub(r'\n{2,}', '\n', t)
    return t.strip()


def main():
    for page in sys.argv[1:]:
        print('\n' + '=' * 70)
        try:
            s = fetch(page)
        except Exception as e:
            print('### PAGE: %s   (FAILED)' % page)
            print('=' * 70)
            print('!! 取得失敗: %s  → 別表記（（拡張）付き等）を試すこと' % e)
            continue
        print('### PAGE: %s' % page)
        print('=' * 70)
        print(strip(s))


if __name__ == '__main__':
    main()
