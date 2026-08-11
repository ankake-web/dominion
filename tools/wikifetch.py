"""DominionStrategy Wiki を Wayback Machine 経由で読む（本体は Anubis の bot 検知で開けない）。

使い方:  python wikifetch.py <PageName> [<PageName> ...]
  例:    python wikifetch.py Bard Blessed_Village "Will-o'-Wisp" Boon Hex Nocturne

ポイント:
 - コスト記号やVP記号は <img> なので、alt 属性を [$4] / [2VP] の形で本文に埋め戻している
   （これをやらないと "You get +" のように金額が消えて読めない）。
 - 出力は UTF-8。日本語版カード名（Other language versions 節）もそのまま出る。
"""
import re, sys, html, urllib.request, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SNAPSHOTS = ['2id_', '2025id_', '2024id_', '2023id_', '2019id_']
BASE = 'http://wiki.dominionstrategy.com/index.php/'


def fetch(page):
    last = None
    for snap in SNAPSHOTS:
        url = 'https://web.archive.org/web/%s/%s%s' % (snap, BASE, urllib.parse.quote(page))
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0',
                                                       'Accept-Encoding': 'identity'})
            with urllib.request.urlopen(req, timeout=90) as r:
                raw = r.read()
        except Exception as e:
            last = e
            continue
        if raw[:2] == b'\x1f\x8b':
            import gzip
            raw = gzip.decompress(raw)
        s = raw.decode('utf-8', 'replace')
        if 'Anubis' in s[:4000] or len(s) < 2000:
            last = 'too short / blocked'
            continue
        return s, snap
    return None, last


def strip(s):
    s = re.sub(r'(?s)<(script|style).*?</\1>', '', s)
    # 記号画像を alt テキストに置換（[$4] や [2VP] を残す）
    s = re.sub(r'<img[^>]*?alt="([^"]*)"[^>]*>', lambda m: '[%s]' % m.group(1)
               if not m.group(1).lower().endswith(('.jpg', '.png', '.gif')) else ' ', s)
    s = re.sub(r'(?s)<[^>]+>', '\n', s)
    t = html.unescape(s)
    t = re.sub(r'[ \t\xa0]+', ' ', t)
    t = re.sub(r'\n[ ]*', '\n', t)
    t = re.sub(r'\n{2,}', '\n', t)
    return t.strip()


def main():
    for page in sys.argv[1:]:
        s, info = fetch(page)
        print('\n' + '=' * 70)
        print('### PAGE: %s   (snapshot=%s)' % (page, info if s else 'FAILED'))
        print('=' * 70)
        if not s:
            print('!! 取得失敗: %s  → 別表記/リダイレクト名を試すこと' % info)
            continue
        t = strip(s)
        # Wayback のツールバー等を落とす
        i = t.find(page.replace('_', ' '))
        print(t[max(0, i - 200):])


if __name__ == '__main__':
    import urllib.parse
    main()
