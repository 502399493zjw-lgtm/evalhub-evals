#!/usr/bin/env python3
"""Lint an EvalHub detail Markdown document without third-party dependencies."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
import re
import sys


SCORE_WORDS = (
    "score",
    "scores",
    "total",
    "aggregate",
    "accuracy",
    "accuracies",
    "pass rate",
    "success rate",
    "win rate",
    "reward",
    "exact match",
    "f1",
    "bleu",
    "rouge",
    "elo",
    "acc",
    "总分",
    "得分",
    "分数",
    "成绩",
    "准确率",
    "正确率",
    "通过率",
    "成功率",
    "胜率",
    "百分比",
    "榜单",
    "分项",
)

IDENTITY_WORDS = (
    "rank",
    "model",
    "participant",
    "agent",
    "harness",
    "name",
    "category",
    "task",
    "scenario",
    "排名",
    "模型",
    "参与者",
    "编排模型",
    "名称",
    "类别",
    "任务",
    "场景",
    "口径",
)

DECIMAL = re.compile(r"(?<![\w.])[-+]?\d[\d,]*\.(\d+)(?![\d.])")
PERCENT_DECIMAL = re.compile(r"(?<![\w.])[-+]?\d[\d,]*\.(\d+)\s*%")
SCORE_UNIT_DECIMAL = re.compile(
    r"(?<![\w.])[-+]?\d[\d,]*\.(\d+)\s*(?:分|points?|pts?)(?![\w])",
    re.IGNORECASE,
)
TABLE_SEPARATOR_CELL = re.compile(r"^:?-{3,}:?$")


@dataclass(frozen=True)
class SourceLine:
    number: int
    text: str


@dataclass(frozen=True)
class Problem:
    line: int
    message: str


def extract_markdown(path: str, text: str) -> list[SourceLine] | None:
    lines = text.splitlines()
    if path == "-" or Path(path).suffix.lower() in {".md", ".markdown"}:
        return [SourceLine(index + 1, line) for index, line in enumerate(lines)]

    detail_index = None
    detail_indent = 0
    for index, line in enumerate(lines):
        match = re.match(r"^(\s*)detail_profile:\s*(?:#.*)?$", line)
        if match:
            detail_index = index
            detail_indent = len(match.group(1))
            break
    if detail_index is None:
        return None

    markdown_index = None
    markdown_indent = 0
    scalar = re.compile(r"^(\s*)markdown:\s*\|[+-]?\s*(?:#.*)?$")
    for index in range(detail_index + 1, len(lines)):
        line = lines[index]
        if line.strip() and len(line) - len(line.lstrip()) <= detail_indent:
            break
        match = scalar.match(line)
        if match:
            markdown_index = index
            markdown_indent = len(match.group(1))
            break
    if markdown_index is None:
        return None

    content: list[tuple[int, str]] = []
    for index in range(markdown_index + 1, len(lines)):
        line = lines[index]
        indent = len(line) - len(line.lstrip())
        if line.strip() and indent <= markdown_indent:
            break
        content.append((index + 1, line))

    nonempty_indents = [
        len(line) - len(line.lstrip()) for _, line in content if line.strip()
    ]
    if not nonempty_indents:
        return []
    content_indent = min(nonempty_indents)
    return [
        SourceLine(number, line[content_indent:] if line.strip() else "")
        for number, line in content
    ]


def split_table_row(line: str) -> list[str]:
    stripped = line.strip()
    if stripped.startswith("|"):
        stripped = stripped[1:]
    if stripped.endswith("|"):
        stripped = stripped[:-1]
    return [cell.strip() for cell in re.split(r"(?<!\\)\|", stripped)]


def is_separator_row(line: str) -> bool:
    cells = split_table_row(line)
    return bool(cells) and all(TABLE_SEPARATOR_CELL.fullmatch(cell) for cell in cells)


def has_score_word(value: str) -> bool:
    lowered = value.casefold()
    return any(word in lowered for word in SCORE_WORDS)


def is_identity_header(value: str) -> bool:
    lowered = value.casefold()
    return any(word in lowered for word in IDENTITY_WORDS)


def decimal_values(value: str) -> list[str]:
    return [match.group(0) for match in DECIMAL.finditer(value) if bad_fraction(match.group(1))]


def bad_fraction(fraction: str) -> bool:
    return len(fraction) > 1 or fraction == "0"


def lint(markdown: list[SourceLine]) -> list[Problem]:
    problems: list[Problem] = []
    first = next((line for line in markdown if line.text.strip()), None)
    if first is None:
        return [Problem(1, "detail_profile.markdown is empty")]
    if not re.match(r"^##\s+\S", first.text):
        problems.append(Problem(first.number, "the reader body must start with an H2 (`##`); the platform owns the Hero and H1"))

    visible: list[SourceLine] = []
    in_fence = False
    fence_marker = ""
    for line in markdown:
        stripped = line.text.lstrip()
        fence = re.match(r"^(```+|~~~+)", stripped)
        if fence:
            marker = fence.group(1)[0]
            if not in_fence:
                in_fence = True
                fence_marker = marker
            elif marker == fence_marker:
                in_fence = False
                fence_marker = ""
            continue
        if in_fence:
            continue
        visible.append(line)
        if re.match(r"^#\s+\S", line.text):
            problems.append(Problem(line.number, "do not add an H1 below the standard Hero"))

        without_urls = re.sub(r"https?://\S+", "", line.text)
        for match in PERCENT_DECIMAL.finditer(without_urls):
            if bad_fraction(match.group(1)):
                problems.append(Problem(line.number, f"percentage `{match.group(0).strip()}` must use at most one meaningful decimal"))
        for match in SCORE_UNIT_DECIMAL.finditer(without_urls):
            if bad_fraction(match.group(1)):
                problems.append(Problem(line.number, f"score `{match.group(0).strip()}` must use at most one meaningful decimal"))

    heading = ""
    index = 0
    while index + 1 < len(visible):
        line = visible[index]
        heading_match = re.match(r"^#{2,6}\s+(.+)$", line.text)
        if heading_match:
            heading = heading_match.group(1)

        if "|" not in line.text or not is_separator_row(visible[index + 1].text):
            index += 1
            continue

        headers = split_table_row(line.text)
        score_columns = {i for i, header in enumerate(headers) if has_score_word(header)}
        if has_score_word(heading):
            score_columns.update(i for i, header in enumerate(headers) if not is_identity_header(header))

        row_index = index + 2
        while row_index < len(visible) and "|" in visible[row_index].text:
            row = visible[row_index]
            cells = split_table_row(row.text)
            for column in score_columns:
                if column >= len(cells):
                    continue
                if "%" in cells[column]:
                    continue
                for value in decimal_values(cells[column]):
                    problems.append(Problem(row.number, f"score-like table value `{value}` must use at most one meaningful decimal"))
            row_index += 1
        index = row_index

    unique: list[Problem] = []
    seen: set[tuple[int, str]] = set()
    for problem in problems:
        key = (problem.line, problem.message)
        if key not in seen:
            seen.add(key)
            unique.append(problem)
    return unique


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check the structure and reader-facing score precision of EvalHub detail Markdown."
    )
    parser.add_argument("paths", nargs="+", help="eval.yaml/Markdown paths, or - for Markdown on stdin")
    args = parser.parse_args()

    failed = False
    for raw_path in args.paths:
        if raw_path == "-":
            text = sys.stdin.read()
        else:
            try:
                text = Path(raw_path).read_text(encoding="utf-8")
            except OSError as error:
                print(f"{raw_path}: {error}", file=sys.stderr)
                failed = True
                continue

        markdown = extract_markdown(raw_path, text)
        if markdown is None:
            print(f"{raw_path}: detail_profile.markdown was not found", file=sys.stderr)
            failed = True
            continue

        problems = lint(markdown)
        if problems:
            failed = True
            for problem in problems:
                print(f"{raw_path}:{problem.line}: {problem.message}", file=sys.stderr)
        else:
            print(f"{raw_path}: detail Markdown check passed")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
