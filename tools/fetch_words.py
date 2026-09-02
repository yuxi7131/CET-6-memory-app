# -*- coding: utf-8 -*-
"""
tools/fetch_words.py
====================

这个脚本做什么
---------------
从公开的 GitHub 词表仓库 mahavivo/english-wordlists 下载两份词表：
  * CET6_edited.txt —— “六级词汇表”(约 2200 词, 含音标/词性/中文释义)
  * CET4_edited.txt —— “四级大纲词汇表”(约 4600 词, 含音标/词性/中文释义)

然后解析、合并、去重, 生成两个数据文件(契约见 docs/SPEC.md §5)：
  * data/words.json    —— 顶层 JSON 数组, 元素为
                          {"word": "...", "phonetic": "...", "pos": "...", "meaning": "..."}
  * app/js/words.js    —— window.CET6_WORDS = [ 同 words.json 的数组 ];

为什么取“四级 ∪ 六级”？
  六级考试默认考生已掌握四级基础词。为方便备考, 这里把四级大纲词与六级词汇表合并成
  一份完整词库：同一个词若两张表都有, 优先采用“六级表”的释义(更详细), 否则用四级表。

只依赖 Python 标准库(urllib / json / re / pathlib), 不需要 pip install 任何包。

以后怎么加新功能/新数据
  如需更换更大的词表, 替换下方的“下载地址列表”与解析规则即可, 输出契约保持不变,
  不会影响 app 里已保存在手机本地的学习进度(进度按单词本身记录)。

运行:
  python tools/fetch_words.py
"""
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

# ---------------------------------------------------------------------------
# 0. 路径常量: 以本脚本所在位置推算项目根目录(不管在哪个目录运行都能找到)
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parents[1]           # 项目根目录
DATA_DIR = ROOT / "data"                              # 放 data/words.json
APP_JS_DIR = ROOT / "app" / "js"                      # 放 app/js/words.js
CACHE_DIR = ROOT / ".cache" / "fetch_words"           # 下载缓存, 避免重复联网

# ---------------------------------------------------------------------------
# 1. 数据来源(mahavivo/english-wordlists)
#    每个文件按“优先级从高到低”准备多个下载地址(镜像), 前一个失败会自动换下一个。
#    说明:
#      - cdn.jsdelivr.net 是本机可达、速度快的公开 CDN;
#      - gh-proxy.com 是 GitHub 资源反向代理, 在 github.com 被墙时可用。
# ---------------------------------------------------------------------------
SOURCE_REPO = "mahavivo/english-wordlists"
SOURCE_BRANCH = "master"
# 处理的顺序很重要: 六级表先处理(优先级高), 四级表后处理(只补充六级表没有的词)。
FILES_IN_ORDER = [
    {"name": "CET6_edited.txt", "label": "六级词汇表"},
    {"name": "CET4_edited.txt", "label": "四级大纲词汇表"},
]
# 每个文件名对应的镜像地址模板
MIRROR_URLS = [
    "https://cdn.jsdelivr.net/gh/{repo}@{branch}/{file}",
    "https://gh-proxy.com/https://raw.githubusercontent.com/{repo}/{branch}/{file}",
]

# ---------------------------------------------------------------------------
# 2. 词性标记表(解析时用来在“解释文本”里切分出 词性 + 中文)
#    旧式大纲用 a.(形容词) ad.(副词), 之后会统一成 adj. / adv.
# ---------------------------------------------------------------------------
POS_ALT = {
    "a.": "adj.", "ad.": "adv.",
}
# 这些标记用来识别一行里“哪个位置开始是一个词性”
POS_PATTERN = r"n|v|vt|vi|a|ad|adj|adv|prep|conj|pron|num|art|int|aux|abbr|comb|pref|suf|modal|interj"


# ---------------------------------------------------------------------------
# 3. 下载
# ---------------------------------------------------------------------------
def download(url: str) -> bytes:
    """下载一个 url, 返回字节内容。"""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (fetch_words)"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def get_file_bytes(name: str) -> bytes:
    """优先用本地缓存, 否则依次尝试各镜像下载, 并写入缓存。"""
    cache_file = CACHE_DIR / name
    if cache_file.exists() and cache_file.stat().st_size > 0:
        return cache_file.read_bytes()

    errors = []
    for template in MIRROR_URLS:
        url = template.format(repo=SOURCE_REPO, branch=SOURCE_BRANCH, file=name)
        try:
            data = download(url)
        except Exception as exc:                      # noqa: BLE001 网络错误种类多, 统一捕获
            errors.append(f"{url} -> {exc}")
            continue
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache_file.write_bytes(data)
        print(f"  下载成功: {name} ({len(data)} 字节)\n    来自: {url}")
        return data
    print("下载失败, 尝试过的地址:")
    for e in errors:
        print("  - " + e)
    sys.exit("无法下载数据源, 请检查网络后重试。没有编造任何数据。")


# ---------------------------------------------------------------------------
# 4. 解析单个词条行
#    词表里一行大致是: 单词 [音标] 词性. 中文释义
#    例如: abandon [əˈbændən] v. 1. 抛弃,放弃 2. 离弃(家园、船只、飞机等)
#          luggage [ˈlʌgidʒ] n. 行李;皮箱
# ---------------------------------------------------------------------------
def is_header_line(line: str) -> bool:
    """跳过目录行、字母分组行(如单独一个大写字母 A)。"""
    if re.match(r"^大学英语", line):
        return True
    if re.match(r"^\(共 \d+ 词\)", line):
        return True
    if re.match(r"^[A-Z]$", line):
        return True
    return False


def fix_phonetic(p: str) -> str:
    """把个别显示异常的音标字符改回常用写法(如 ә->ə, ∫->ʃ)。"""
    p = p.replace("ә", "ə").replace("∫", "ʃ")
    return re.sub(r"\s+", " ", p).strip()


# 音标里常出现的字符, 用来识别“没有方括号包裹的音标”(极少数行)
IPA_HINT = set("ˈˌːəɚɝæɑɒɔɛɪʊʌɜʃʒɡŋθðtʃdʒoʊaɪeɪɔɪʊər")


def parse_one_line(line: str):
    """把一行解析成 {word, phons, segs}。

    * word   —— 小写单词
    * phons  —— 这一行里出现的音标(可能多个, 如一词多音)
    * segs   —— [{pos, text}], text 是还没有拆“1. 2. 3.”编号的中文片段
    """
    if is_header_line(line):
        return None
    # 复合词/短语(词头含空格, 如 "buzz word [...]")不属于“单个单词”, 整行跳过
    if re.match(r"^[A-Za-z][A-Za-z'\-]* [A-Za-z][A-Za-z'\-]*\s*\[", line):
        return None
    m = re.match(r"^([A-Za-z][A-Za-z'.\-]*)", line)
    if not m:
        return None
    word = m.group(1).lower()
    rest = line[m.end():]

    # 4.1 收集所有 [音标]; 其余文字进 body
    phons = []
    body_parts = []
    for part in re.split(r"(\[[^\]]*\])", rest):
        if not part:
            continue
        if part.startswith("["):
            p = fix_phonetic(part[1:-1])
            if p:
                phons.append(p)
        else:
            body_parts.append(part)
    body = "".join(body_parts)

    # 4.2 少数行音标没有方括号(如 arbitrary ˈɑːbɪtrərɪ /adj. ...)
    m2 = re.match(r"^\s*(\S+)\s+(.*)$", body, re.S)
    if m2 and not phons and any(c in IPA_HINT for c in m2.group(1)):
        phons.append(fix_phonetic(m2.group(1)))
        body = m2.group(2)

    # 4.3 丢弃 "||" 之后的内容(词组/例句, 不属于核心释义)
    if "||" in body:
        body = body.split("||", 1)[0]
    # 4.4 丢弃行首残留的同形词编号(如 attribute 1[音标] -> 前面的 “1”)
    body = re.sub(r"^\s*\d{1,2}\s*", "", body)

    return {"word": word, "phons": phons, "segs": split_by_pos(body)}


def split_by_pos(body: str):
    """把去掉音标之后的文字, 按“词性标记”切成若干段。

    例: "n. 废除,消除 v. 废除,取消"
        -> [{"pos": "n.", "text": "废除,消除"}, {"pos": "v.", "text": "废除,取消"}]
    """
    body = body.replace("·", ".")                    # 个别行用中点代替点
    sentinel_re = re.compile(r"((?:^|[\s/；;&]))((?:%s)\.[\s]?)" % POS_PATTERN)
    tmp = sentinel_re.sub(lambda mm: "\x00" + mm.group(2), body)
    result = []
    for chunk in tmp.split("\x00"):
        chunk = chunk.strip()
        if not chunk:
            continue
        pm = re.match(r"^((?:%s)\.)" % POS_PATTERN, chunk)
        if pm:
            pos = POS_ALT.get(pm.group(1), pm.group(1))
            text = chunk[pm.end():]
        else:
            pos = ""
            text = chunk
        text = text.strip(" \t:：;；、,，&")
        if text:
            result.append({"pos": pos, "text": text})
    return result


# 中文字符范围, 用来判断一段文字里是否真有中文
CJK_RE = re.compile(r"[一-鿿]")


def text_to_senses(text: str):
    """把一段中文释义按 “1. 2. 3.” 编号切开, 变成若干中文义项。

    例: "1. 抛弃,放弃 2. 离弃(家园...)" -> ["抛弃,放弃", "离弃(家园...)"]
    """
    text = re.sub(r"^\([^一-鿿]*?\)\s*", "", text)      # 去开头无中文括注, 如 (=that is)
    text = re.sub(r"^\((缩|复|常用复|pl\.?|sing\.?|美|英|AmE|BrE)\)\s*", "", text)
    parts = re.split(r"\(?\d{1,2}\s*[\.、．]\s*\)?", text)
    out = []
    for p in parts:
        p = p.strip(" \t:：;；、,，。&")
        p = re.sub(r"\s+", " ", p)
        p = re.sub(r"(?<=[一-鿿])\s+(?=[一-鿿])", "", p)   # 去掉夹在两个汉字之间的空格
        if p:
            out.append(p)
    return out


def compact_senses(senses):
    """去掉重复的义项, 以及被更长义项包含的冗余义项。"""
    kept = []
    for s in senses:
        if any(s in k for k in kept):
            continue
        kept = [k for k in kept if not (k in s)]
        kept.append(s)
    return kept


# ---------------------------------------------------------------------------
# 5. 合并成最终词库
# ---------------------------------------------------------------------------
def merge_wordlist() -> dict:
    """按 FILES_IN_ORDER 的顺序处理词表, 返回 {单词: 记录}。

    记录字段: phons(list), pos(list), senses(list)
    """
    merged = {}
    dropped_phrase = 0
    for first, finfo in enumerate(FILES_IN_ORDER):
        name = finfo["name"]
        label = finfo["label"]
        print(f"[{label}] 读取 {name} ...")
        data = get_file_bytes(name).decode("utf-8-sig", errors="replace")
        lines = [ln.rstrip() for ln in data.splitlines() if ln.strip()]
        added = 0
        for line in lines:
            parsed = parse_one_line(line)
            if not parsed:
                continue
            w = parsed["word"]
            if " " in w or "\t" in w:
                dropped_phrase += 1
                continue
            # 六级表优先: 四级表里重复的词不再追加
            if first > 0 and w in merged:
                continue
            rec = merged.setdefault(w, {"phons": [], "pos": [], "senses": []})
            for p in parsed["phons"]:
                if p and p not in rec["phons"]:
                    rec["phons"].append(p)
            for s in parsed["segs"]:
                if s["pos"] and s["pos"] not in rec["pos"]:
                    rec["pos"].append(s["pos"])
                for sense in text_to_senses(s["text"]):
                    if sense not in rec["senses"]:
                        rec["senses"].append(sense)
            added += 1
        print(f"  该表有效词条(新增/累计处理): {added}")

    # 词性润色: 已有 vt./vi. 时就不必保留笼统的 v.
    for rec in merged.values():
        if "v." in rec["pos"] and ("vt." in rec["pos"] or "vi." in rec["pos"]):
            rec["pos"] = [p for p in rec["pos"] if p != "v."]
        rec["senses"] = compact_senses(rec["senses"])
    return merged, dropped_phrase


# ---------------------------------------------------------------------------
# 6. 输出 words.json 与 words.js
# ---------------------------------------------------------------------------
def record_to_dict(word: str, rec: dict) -> dict:
    """把内部记录转成契约要求的一个元素。"""
    phonetic = " / ".join(rec["phons"])               # 多个音标用 “ / ” 连接
    pos = "/".join(rec["pos"])                        # 多个词性用 “/” 连接
    meaning = ";".join(rec["senses"])                 # 多个义项用 “;” 连接(契约)
    # 释义里若残留中文分号, 也统一成英文分号
    meaning = meaning.replace("；", ";")
    return {
        "word": word,
        "phonetic": phonetic,
        "pos": pos,
        "meaning": meaning,
    }


def main() -> None:
    print("=" * 64)
    print("抓取并生成六级(四级∪六级)词库")
    print("数据来源:", SOURCE_REPO)
    print("=" * 64)

    merged, dropped_phrase = merge_wordlist()

    # 6.1 丢弃仍然没有中文释义的条目(理论上不会有, 保险起见)
    words = []
    dropped_no_mean = 0
    for word in sorted(merged):
        rec = merged[word]
        if not rec["senses"] or not any(CJK_RE.search(s) for s in rec["senses"]):
            dropped_no_mean += 1
            continue
        words.append(record_to_dict(word, rec))

    # 6.2 统计
    total = len(words)
    no_phonetic = sum(1 for w in words if not w["phonetic"])
    no_pos = sum(1 for w in words if not w["pos"])
    print("-" * 64)
    print(f"最终词条数: {total}")
    print(f"缺少音标: {no_phonetic} ({no_phonetic / total:.2%})")
    print(f"缺少词性: {no_pos} ({no_pos / total:.2%})")
    print(f"被跳过的复合词/短语行: {dropped_phrase}")
    print(f"被跳过且无中文释义的条目: {dropped_no_mean}")

    # 6.3 写 data/words.json
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    json_text = json.dumps(words, ensure_ascii=False, indent=1)
    with open(DATA_DIR / "words.json", "w", encoding="utf-8") as f:
        f.write(json_text + "\n")
    print("已写入:", DATA_DIR / "words.json")

    # 6.4 写 app/js/words.js (内容 = window.CET6_WORDS = [ 同数组 ];)
    APP_JS_DIR.mkdir(parents=True, exist_ok=True)
    js_text = "window.CET6_WORDS = " + json_text + ";\n"
    with open(APP_JS_DIR / "words.js", "w", encoding="utf-8") as f:
        f.write(js_text)
    print("已写入:", APP_JS_DIR / "words.js")

    print("完成。")


if __name__ == "__main__":
    main()
