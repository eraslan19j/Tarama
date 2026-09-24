#!/usr/bin/env python3
"""
RepoMind - Automatic Code Quality & Structure Analyzer

A professional CLI tool for analyzing software projects. It examines source
files across multiple languages, collects statistics, detects code-quality
issues, computes cyclomatic complexity, identifies duplicate code, parses
dependencies, and produces actionable risk reports.

Designed for Termux and Linux environments — no external dependencies, no
internet required, no root access needed.

Usage:
    python3 repomind.py /path/to/project
    python3 repomind.py https://github.com/user/repo.git --all --json report.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple


# =============================================================================
# Sabitler (Constants)
# =============================================================================

SUPPORTED_EXTENSIONS: Dict[str, str] = {
    ".kt": "kotlin",
    ".java": "java",
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".jsx": "javascript",
    ".xml": "xml",
    ".json": "json",
    ".gradle": "gradle",
    ".kts": "kotlin",
    ".md": "markdown",
}

EXCLUDED_DIRS: Set[str] = {
    ".git",
    "build",
    "node_modules",
    ".gradle",
    ".idea",
    "target",
    "__pycache__",
    ".venv",
    "venv",
    "dist",
    ".mvn",
    ".cache",
}

LARGE_FILE_THRESHOLD = 50_000
LONG_FUNCTION_THRESHOLD = 40
HIGH_COMPLEXITY_THRESHOLD = 10
MEDIUM_COMPLEXITY_THRESHOLD = 5
COMPLEXITY_WARNING_THRESHOLD = 3
DUPLICATE_WINDOW_SIZE = 5
DUPLICATE_MIN_MATCHES = 2
FILE_SCAN_LIMIT = 10_000

# Regex patterns for security and pattern detection
URL_PATTERN = re.compile(
    r'\b(?:https?://|ftp://|ssh://|git://|file://)'
    r'[^\s<>"\'\)\]]+'
)

# Hardcoded credential patterns
API_KEY_PATTERNS = [
    re.compile(r'(?i)(?:api[_-]?key|apikey)\s*[=:]\s*["\']?([A-Za-z0-9_\-]{16,})["\']?'),
    re.compile(r'(?i)(?:secret[_-]?key|secretkey|secret)\s*[=:]\s*["\']?([A-Za-z0-9_\-]{16,})["\']?'),
    re.compile(r'(?:token|bearer)\s*[=:]\s*["\']([A-Za-z0-9_\-\.]{16,})["\']', re.IGNORECASE),
    re.compile(r'AKIA[0-9A-Z]{16}'),
    re.compile(r'gh[pousr]_[A-Za-z0-9]{20,}'),
    re.compile(r'(?i)password\s*[:=]\s*["\'][^"\'\s]{4,}["\']'),
]

# TODO/FIXME/HACK/XXX patterns
TODO_PATTERN = re.compile(r'\b(TODO|FIXME|HACK|XXX)\b\s*:?', re.IGNORECASE)

# Deprecated API patterns per language
DEPRECATED_PATTERNS: Dict[str, List[re.Pattern]] = {
    "kotlin": [
        re.compile(r'\b(?:findViewById|@Suppress)\b'),
        re.compile(r'\bdeprecated\b', re.IGNORECASE),
    ],
    "java": [
        re.compile(r'\.contains\s*\('),
        re.compile(r'\bDate\b\s*\('),
        re.compile(r'\bVector\b'),
    ],
    "javascript": [
        re.compile(r'\beval\s*\('),
        re.compile(r'\bdocument\.write\b'),
        re.compile(r'\binnerHTML\b'),
    ],
    "typescript": [
        re.compile(r'\beval\s*\('),
        re.compile(r'\bdocument\.write\b'),
    ],
    "python": [
        re.compile(r'\bexec\s*\('),
        re.compile(r'\beval\s*\('),
        re.compile(r'\b__import__\b'),
    ],
    "gradle": [
        re.compile(r'\bjcenter\(\)'),
        re.compile(r'\bmavenCentral\(\)'),
    ],
}


# =============================================================================
# Numaralandırmalar (Enums)
# =============================================================================

class RiskLevel(Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

    @property
    def severity(self) -> int:
        return {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}[self.value]


class AnalysisType(Enum):
    STATS = "stats"
    SECURITY = "security"
    DUPLICATES = "duplicates"
    COMPLEXITY = "complexity"
    DEPENDENCIES = "dependencies"
    TODOS = "todos"
    ALL = "all"


# =============================================================================
# Veri Sınıfları (Data Classes)
# =============================================================================

@dataclass
class FunctionInfo:
    name: str
    start_line: int
    end_line: int
    complexity: int = 1
    line_count: int = 0


@dataclass
class Issue:
    file_path: str
    line_number: int
    severity: RiskLevel
    category: str
    message: str
    detail: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "file": self.file_path,
            "line": self.line_number,
            "severity": self.severity.value,
            "category": self.category,
            "message": self.message,
            "detail": self.detail,
        }


@dataclass
class FileStats:
    file_path: str
    language: str
    total_lines: int = 0
    code_lines: int = 0
    blank_lines: int = 0
    comment_lines: int = 0
    function_count: int = 0
    class_count: int = 0
    import_count: int = 0
    functions: List[FunctionInfo] = field(default_factory=list)
    issues: List[Issue] = field(default_factory=list)
    file_size: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "file": self.file_path,
            "language": self.language,
            "total_lines": self.total_lines,
            "code_lines": self.code_lines,
            "blank_lines": self.blank_lines,
            "comment_lines": self.comment_lines,
            "functions": self.function_count,
            "classes": self.class_count,
            "imports": self.import_count,
            "file_size": self.file_size,
            "functions_detail": [
                {
                    "name": f.name,
                    "start_line": f.start_line,
                    "end_line": f.end_line,
                    "complexity": f.complexity,
                    "lines": f.line_count,
                }
                for f in self.functions
            ],
            "issues": [i.to_dict() for i in self.issues],
        }


@dataclass
class DuplicateMatch:
    file_path: str
    start_line: int
    end_line: int
    lines: List[str]
    hash_key: str
    match_count: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "file": self.file_path,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "match_count": self.match_count,
            "lines": self.lines[:10],
        }


@dataclass
class Dependency:
    group: str
    name: str
    scope: str
    line_number: int
    version: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "group": self.group,
            "name": self.name,
            "scope": self.scope,
            "version": self.version,
            "line": self.line_number,
        }


@dataclass
class AnalysisResult:
    project_path: str
    file_stats: List[FileStats] = field(default_factory=list)
    issues: List[Issue] = field(default_factory=list)
    duplicates: List[DuplicateMatch] = field(default_factory=list)
    dependencies: Dict[str, Any] = field(default_factory=dict)
    project_structure: Dict[str, Any] = field(default_factory=dict)
    top_complex_functions: List[Dict[str, Any]] = field(default_factory=list)
    scanned_files: int = 0
    skipped_files: int = 0
    excluded_dirs_found: Set[str] = field(default_factory=set)

    def to_dict(self) -> Dict[str, Any]:
        risk_breakdown: Dict[str, int] = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        for issue in self.issues:
            risk_breakdown[issue.severity.value] += 1

        total_lines = sum(fs.total_lines for fs in self.file_stats)
        total_classes = sum(fs.class_count for fs in self.file_stats)
        total_functions = sum(fs.function_count for fs in self.file_stats)

        return {
            "summary": {
                "files": len(self.file_stats),
                "scanned_files": self.scanned_files,
                "skipped_files": self.skipped_files,
                "lines": total_lines,
                "classes": total_classes,
                "functions": total_functions,
                "total_issues": len(self.issues),
                "risk_breakdown": risk_breakdown,
            },
            "files": [fs.to_dict() for fs in self.file_stats],
            "issues": [i.to_dict() for i in self.issues],
            "duplicates": [d.to_dict() for d in self.duplicates],
            "dependencies": {
                k: [d.to_dict() for d in v] for k, v in self.dependencies.items()
            },
            "project_structure": self.project_structure,
            "top_complex_functions": self.top_complex_functions,
            "excluded_dirs_found": list(self.excluded_dirs_found),
        }


# =============================================================================
# Dil Tanımları (Language Definitions)
# =============================================================================

class LanguageDefinition:
    """Defines language-specific parsing rules."""

    def __init__(
        self,
        name: str,
        extensions: List[str],
        single_comments: List[str],
        block_comment_start: str = "",
        block_comment_end: str = "",
        triple_quotes: Optional[List[str]] = None,
        function_pattern: str = "",
        class_pattern: str = "",
        import_patterns: Optional[List[str]] = None,
        complexity_keywords: Optional[List[str]] = None,
    ):
        self.name = name
        self.extensions = set(extensions)
        self.single_comments = single_comments
        self.block_comment_start = block_comment_start
        self.block_comment_end = block_comment_end
        self.triple_quotes = triple_quotes or []
        self.function_pattern = re.compile(function_pattern) if function_pattern else None
        self.class_pattern = re.compile(class_pattern) if class_pattern else None
        self.import_patterns = [re.compile(p) for p in (import_patterns or [])]
        self.complexity_keywords = complexity_keywords or []


def _build_language_registry() -> Dict[str, LanguageDefinition]:
    return {
        "python": LanguageDefinition(
            name="Python",
            extensions=[".py"],
            single_comments=["#"],
            block_comment_start='"""',
            block_comment_end='"""',
            triple_quotes=['"""', "'''"],
            function_pattern=r'^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(',
            class_pattern=r'^\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)',
            import_patterns=[
                r'^\s*import\s+(\S+)',
                r'^\s*from\s+(\S+)\s+import\s+',
            ],
            complexity_keywords=["if", "elif", "for", "while", "and", "or", "except",
                                 "case", "when", "assert", "with", "yield", "lambda"],
        ),
        "kotlin": LanguageDefinition(
            name="Kotlin",
            extensions=[".kt", ".kts"],
            single_comments=["//"],
            block_comment_start="/*",
            block_comment_end="*/",
            function_pattern=r'^\s*(?:fun|suspend\s+fun)\s+([a-zA-Z_][a-zA-Z0-9_]*)',
            class_pattern=r'^\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)',
            import_patterns=[r'^\s*import\s+(\S+)'],
            complexity_keywords=["if", "for", "while", "when", "catch", "&&", "||",
                                 "?:", "let", "apply", "also", "filter", "map"],
        ),
        "java": LanguageDefinition(
            name="Java",
            extensions=[".java"],
            single_comments=["//"],
            block_comment_start="/*",
            block_comment_end="*/",
            function_pattern=r'^\s*(?:public|private|protected|static|final|void|'
                             r'[a-zA-Z_][a-zA-Z0-9_<>?\s]*)\s+'
                             r'([a-zA-Z_][a-zA-Z0-9_]*)\s*\(',
            class_pattern=r'^\s*(?:public|abstract|final)?\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)',
            import_patterns=[r'^\s*import\s+(?:static\s+)?(\S+)'],
            complexity_keywords=["if", "for", "while", "case", "catch", "&&", "||", "?:"],
        ),
        "javascript": LanguageDefinition(
            name="JavaScript",
            extensions=[".js", ".jsx"],
            single_comments=["//"],
            block_comment_start="/*",
            block_comment_end="*/",
            function_pattern=r'^\s*(?:async\s+)?function\s+([a-zA-Z_][a-zA-Z0-9_]*)',
            class_pattern=r'^\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)',
            import_patterns=[
                r'^\s*import\s+.*?\s+from\s+[\'"]([^\'"]+)[\'"]',
                r'^\s*import\s+[\'"]([^\'"]+)[\'"]',
                r'^\s*require\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)',
            ],
            complexity_keywords=["if", "for", "while", "case", "catch", "&&", "||", "?:",
                                 "try", "switch"],
        ),
        "typescript": LanguageDefinition(
            name="TypeScript",
            extensions=[".ts", ".tsx"],
            single_comments=["//"],
            block_comment_start="/*",
            block_comment_end="*/",
            function_pattern=r'^\s*(?:async\s+)?(?:export\s+)?function\s*'
                             r'([a-zA-Z_][a-zA-Z0-9_]*)',
            class_pattern=r'^\s*(?:export\s+)?class\s+([a-zA-Z_][a-zA-Z0-9_]*)',
            import_patterns=[
                r'^\s*import\s+.*?\s+from\s+[\'"]([^\'"]+)[\'"]',
                r'^\s*import\s+[\'"]([^\'"]+)[\'"]',
                r'^\s*require\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)',
            ],
            complexity_keywords=["if", "for", "while", "case", "catch", "&&", "||", "?:",
                                 "try", "switch"],
        ),
        "xml": LanguageDefinition(
            name="XML",
            extensions=[".xml"],
            single_comments=["<!--"],
            block_comment_start="<!--",
            block_comment_end="-->",
            function_pattern="",
            class_pattern="",
            import_patterns=[],
            complexity_keywords=[],
        ),
        "json": LanguageDefinition(
            name="JSON",
            extensions=[".json"],
            single_comments=[],
            block_comment_start="",
            block_comment_end="",
            function_pattern="",
            class_pattern="",
            import_patterns=[],
            complexity_keywords=[],
        ),
        "gradle": LanguageDefinition(
            name="Gradle",
            extensions=[".gradle"],
            single_comments=["//"],
            block_comment_start="/*",
            block_comment_end="*/",
            function_pattern="",
            class_pattern="",
            import_patterns=[],
            complexity_keywords=["if", "for", "when", "&&", "||"],
        ),
        "markdown": LanguageDefinition(
            name="Markdown",
            extensions=[".md"],
            single_comments=[],
            block_comment_start="",
            block_comment_end="",
            function_pattern="",
            class_pattern="",
            import_patterns=[],
            complexity_keywords=[],
        ),
    }


LANGUAGE_REGISTRY = _build_language_registry()


class LanguageRegistry:
    """Registry for language definitions, providing lookup by extension and key."""

    def __init__(self, registry: Dict[str, LanguageDefinition]):
        self._registry = registry

    def get(self, lang_key: str) -> Optional[LanguageDefinition]:
        return self._registry.get(lang_key)

    def get_by_extension(self, ext: str) -> Optional[LanguageDefinition]:
        lang_key = SUPPORTED_EXTENSIONS.get(ext.lower())
        if lang_key:
            return self._registry.get(lang_key)
        return None

    def all_languages(self) -> List[str]:
        return list(self._registry.keys())

    def all_definitions(self) -> Dict[str, LanguageDefinition]:
        return dict(self._registry)

    def supported_extensions(self) -> Set[str]:
        return set(SUPPORTED_EXTENSIONS.keys())


LANGUAGE_REGISTRY_INSTANCE = LanguageRegistry(LANGUAGE_REGISTRY)


def get_language_for_extension(ext: str) -> Optional[str]:
    return SUPPORTED_EXTENSIONS.get(ext.lower())


def get_language_definition(lang_key: str) -> Optional[LanguageDefinition]:
    return LANGUAGE_REGISTRY.get(lang_key)


# =============================================================================
# Satır Sınıflandırıcı (Line Classifier)
# =============================================================================

class LineType(Enum):
    CODE = "code"
    COMMENT = "comment"
    BLANK = "blank"


class LineClassifier:
    """Classifies each line of a file as code, comment, or blank."""

    def __init__(self, lang_def: Optional[LanguageDefinition]):
        self.lang_def = lang_def
        self.in_block_comment = False
        self.in_triple_quote = False
        self._triple_quote_char: str = ""

    def classify(self, line: str) -> LineType:
        stripped = line.strip()

        if not self.lang_def:
            return self._classify_generic(line, stripped)

        # --- Markdown handling ---
        if self.lang_def.name == "Markdown":
            return self._classify_markdown(line, stripped)

        # --- JSON handling ---
        if self.lang_def.name == "JSON":
            if not stripped:
                return LineType.BLANK
            return LineType.CODE

        # --- Triple-quote languages (Python) ---
        if self.lang_def.triple_quotes:
            result = self._classify_triple_quote(line, stripped)
            if result is not None:
                return result

        # --- Block comments (C-like, XML) ---
        if self.lang_def.block_comment_start and self.lang_def.block_comment_end:
            if self.in_block_comment:
                return self._handle_block_comment_end(line, stripped)
            return self._handle_block_comment_start(line, stripped)

        # --- Single-line comments ---
        if stripped:
            for marker in self.lang_def.single_comments:
                if stripped.startswith(marker):
                    return LineType.COMMENT

        # --- Blank or code ---
        if not stripped:
            return LineType.BLANK
        return LineType.CODE

    def _classify_generic(self, line: str, stripped: str) -> LineType:
        if not stripped:
            return LineType.BLANK
        return LineType.CODE

    def _classify_markdown(self, line: str, stripped: str) -> LineType:
        if not stripped:
            return LineType.BLANK
        return LineType.COMMENT

    def _classify_triple_quote(self, line: str, stripped: str) -> Optional[LineType]:
        """Handle Python-style triple-quoted strings/comments."""
        if self.in_triple_quote:
            end_marker = self._triple_quote_char
            if end_marker in line:
                self.in_triple_quote = False
                after = line.split(end_marker, 1)[1].strip()
                if after:
                    return LineType.CODE
                return LineType.COMMENT
            return LineType.COMMENT

        for tq in self.lang_def.triple_quotes:
            idx = line.find(tq)
            if idx != -1:
                self.in_triple_quote = True
                self._triple_quote_char = tq
                before = line[:idx].strip()
                after_tq = line[idx + len(tq):]
                if tq in after_tq:
                    self.in_triple_quote = False
                    self._triple_quote_char = ""
                    if before:
                        return LineType.CODE
                    return LineType.COMMENT
                if before:
                    return LineType.CODE
                return LineType.COMMENT

        # Fallback to single-line comment
        if stripped and not stripped.startswith("#"):
            for marker in self.lang_def.single_comments:
                if stripped.startswith(marker):
                    return LineType.COMMENT
        if stripped.startswith("#"):
            return LineType.COMMENT
        if not stripped:
            return LineType.BLANK
        return LineType.CODE

    def _handle_block_comment_end(self, line: str, stripped: str) -> LineType:
        end_idx = line.find(self.lang_def.block_comment_end)
        if end_idx != -1:
            self.in_block_comment = False
            after = line[end_idx + len(self.lang_def.block_comment_end):]
            if after.strip():
                return LineType.CODE
            return LineType.COMMENT
        return LineType.COMMENT

    def _handle_block_comment_start(self, line: str, stripped: str) -> LineType:
        start_idx = line.find(self.lang_def.block_comment_start)
        if start_idx == -1:
            if stripped:
                for marker in self.lang_def.single_comments:
                    if stripped.startswith(marker):
                        return LineType.COMMENT
            if not stripped:
                return LineType.BLANK
            return LineType.CODE

        after = line[start_idx + len(self.lang_def.block_comment_start):]
        end_idx = after.find(self.lang_def.block_comment_end)
        if end_idx != -1:
            before = line[:start_idx].strip()
            after_end = after[end_idx + len(self.lang_def.block_comment_end):]
            if before and after_end:
                return LineType.CODE
            if before:
                return LineType.CODE
            if after_end:
                return LineType.CODE
            return LineType.COMMENT

        self.in_block_comment = True
        before = line[:start_idx].strip()
        if before:
            return LineType.CODE
        return LineType.COMMENT


# =============================================================================
# Dosya Çözici (File Parser)
# =============================================================================

class FileParser:
    """Parses a single source file and collects statistics."""

    def __init__(self, lang_key: str):
        self.lang_key = lang_key
        self.lang_def = get_language_definition(lang_key)

    def parse_file(self, file_path: str) -> FileStats:
        stats = FileStats(
            file_path=file_path,
            language=self.lang_key,
        )

        try:
            file_size = os.path.getsize(file_path)
            stats.file_size = file_size
        except OSError:
            file_size = 0
            stats.file_size = 0

        if file_size > LARGE_FILE_THRESHOLD * 10:
            stats.issues.append(Issue(
                file_path=file_path,
                line_number=0,
                severity=RiskLevel.LOW,
                category="large_file",
                message="File is very large",
                detail=f"File size: {file_size} bytes",
            ))

        lines: List[str] = []
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
        except (OSError, UnicodeDecodeError):
            try:
                with open(file_path, "r", encoding="latin-1", errors="replace") as f:
                    lines = f.readlines()
            except OSError:
                return stats

        stats.total_lines = len(lines)
        classifier = LineClassifier(self.lang_def)
        imported_names = self._extract_imports(lines)

        for i, raw_line in enumerate(lines):
            line_no = i + 1
            line_type = classifier.classify(raw_line)
            if line_type == LineType.BLANK:
                stats.blank_lines += 1
            elif line_type == LineType.COMMENT:
                stats.comment_lines += 1
            else:
                stats.code_lines += 1

            self._check_line_patterns(
                file_path, line_no, raw_line, stats, imported_names
            )

        # Post-process: find functions
        if self.lang_def and self.lang_def.function_pattern:
            stats.functions = self._find_functions(lines, file_path)
            stats.function_count = len(stats.functions)

            for func in stats.functions:
                if func.line_count > LONG_FUNCTION_THRESHOLD:
                    stats.issues.append(Issue(
                        file_path=file_path,
                        line_number=func.start_line,
                        severity=RiskLevel.MEDIUM
                        if func.line_count < LONG_FUNCTION_THRESHOLD * 2
                        else RiskLevel.HIGH,
                        category="long_function",
                        message=f"Long function: {func.name}",
                        detail=f"Function spans {func.line_count} lines "
                               f"(threshold: {LONG_FUNCTION_THRESHOLD})",
                    ))

        # Check large file
        if stats.total_lines > LARGE_FILE_THRESHOLD:
            stats.issues.append(Issue(
                file_path=file_path,
                line_number=0,
                severity=RiskLevel.MEDIUM
                if stats.total_lines < LARGE_FILE_THRESHOLD * 3
                else RiskLevel.HIGH,
                category="large_file",
                message=f"Large file: {stats.total_lines} lines",
                detail=f"File exceeds {LARGE_FILE_THRESHOLD} line threshold",
            ))

        # Check unused imports
        if imported_names:
            unused = self._find_unused_imports(imported_names, lines, file_path)
            stats.issues.extend(unused)

        stats.import_count = len(imported_names)
        stats.class_count = self._count_classes(lines)
        stats.issues.sort(key=lambda x: x.line_number)

        return stats

    def _extract_imports(self, lines: List[str]) -> List[str]:
        if not self.lang_def or not self.lang_def.import_patterns:
            return []

        imports: List[str] = []
        for line in lines:
            for pattern in self.lang_def.import_patterns:
                match = pattern.search(line)
                if match:
                    name = match.group(1) or match.group(0)
                    imports.append(name.strip().rstrip(";"))
        return imports

    def _find_functions(self, lines: List[str], file_path: str) -> List[FunctionInfo]:
        if not self.lang_def or not self.lang_def.function_pattern:
            return []

        functions: List[FunctionInfo] = []
        for i, line in enumerate(lines):
            match = self.lang_def.function_pattern.search(line)
            if match:
                name = match.group(1) if match.lastindex and match.group(1) else match.group(0)
                func = FunctionInfo(
                    name=name,
                    start_line=i + 1,
                    end_line=i + 1,
                )
                functions.append(func)

        # Calculate function end lines, complexity, and line counts
        for idx, func in enumerate(functions):
            func.end_line = self._find_function_end(lines, func.start_line - 1, idx, functions)
            func.line_count = func.end_line - func.start_line + 1
            body_lines = lines[func.start_line - 1 : func.end_line]
            func.complexity = self._calculate_complexity(body_lines)

        return functions

    def _find_function_end(
        self,
        lines: List[str],
        start_idx: int,
        func_idx: int,
        functions: List[FunctionInfo],
    ) -> int:
        if not self.lang_def:
            return start_idx + 1

        if self.lang_def.name == "Python":
            return self._find_python_function_end(lines, start_idx)

        # C-like: brace counting
        brace_depth = 0
        found_open = False
        for i in range(start_idx, len(lines)):
            for char in lines[i]:
                if char == "{":
                    brace_depth += 1
                    found_open = True
                elif char == "}":
                    brace_depth -= 1
                    if found_open and brace_depth == 0:
                        return i + 1
            if found_open and brace_depth == 0 and i > start_idx:
                return i
        return len(lines)

    def _find_python_function_end(self, lines: List[str], start_idx: int) -> int:
        base_indent = len(lines[start_idx]) - len(lines[start_idx].lstrip())
        for i in range(start_idx + 1, len(lines)):
            stripped = lines[i].strip()
            if not stripped or stripped.startswith("#"):
                continue
            current_indent = len(lines[i]) - len(lines[i].lstrip())
            if current_indent <= base_indent and not stripped.startswith("@"):
                return i - 1 if i > start_idx + 1 else start_idx + 1
        return len(lines)

    def _calculate_complexity(self, lines: List[str]) -> int:
        if not self.lang_def or not self.lang_def.complexity_keywords:
            return 1

        complexity = 1
        for line in lines:
            lower = line.lower()
            for kw in self.lang_def.complexity_keywords:
                pattern = r'\b' + re.escape(kw.lower()) + r'\b'
                complexity += len(re.findall(pattern, lower))
        return max(complexity, 1)

    def _count_classes(self, lines: List[str]) -> int:
        if not self.lang_def or not self.lang_def.class_pattern:
            return 0
        count = 0
        for line in lines:
            if self.lang_def.class_pattern.search(line):
                count += 1
        return count

    def _find_unused_imports(
        self, imported_names: List[str], lines: List[str], file_path: str
    ) -> List[Issue]:
        """Detect potentially unused imports."""
        issues: List[Issue] = []
        if not self.lang_def:
            return issues

        import_line_indices: Set[int] = self._find_import_line_indices(lines)

        for i, name in enumerate(imported_names):
            if not name:
                continue
            short_name = name.split(".")[-1] if "." in name else name

            is_used = False
            for j, line in enumerate(lines):
                if j in import_line_indices:
                    continue
                if short_name and re.search(r'\b' + re.escape(short_name) + r'\b', line):
                    is_used = True
                    break

            if not is_used:
                import_line_no = self._find_import_line_no(lines, name, i)
                issues.append(Issue(
                    file_path=file_path,
                    line_number=import_line_no,
                    severity=RiskLevel.LOW,
                    category="unused_import",
                    message=f"Potentially unused import: {name}",
                    detail=f"Symbol '{short_name}' not referenced in code",
                ))

        return issues

    def _find_import_line_indices(self, lines: List[str]) -> Set[int]:
        """Find line indices that are import statements."""
        indices: Set[int] = set()
        if not self.lang_def or not self.lang_def.import_patterns:
            return indices
        for i, line in enumerate(lines):
            for pattern in self.lang_def.import_patterns:
                if pattern.search(line):
                    indices.add(i)
                    break
        return indices

    def _find_import_line_no(self, lines: List[str], name: str, index: int) -> int:
        """Find the line number for a specific import by index."""
        count = 0
        if not self.lang_def or not self.lang_def.import_patterns:
            return index + 1
        for i, line in enumerate(lines):
            for pattern in self.lang_def.import_patterns:
                if pattern.search(line):
                    if count == index:
                        return i + 1
                    count += 1
                    break
        return index + 1

    def _check_line_patterns(
        self,
        file_path: str,
        line_no: int,
        line: str,
        stats: FileStats,
        imported_names: List[str],
    ) -> None:
        # TODO/FIXME/HACK/XXX
        todo_match = TODO_PATTERN.search(line)
        if todo_match:
            keyword = todo_match.group(1).upper()
            severity = RiskLevel.CRITICAL if keyword in ("FIXME", "HACK", "XXX") else RiskLevel.LOW
            if keyword == "FIXME":
                severity = RiskLevel.HIGH
            elif keyword == "HACK":
                severity = RiskLevel.MEDIUM
            stats.issues.append(Issue(
                file_path=file_path,
                line_number=line_no,
                severity=severity,
                category="todo",
                message=f"{keyword} comment",
                detail=line.strip(),
            ))

        # Deprecated APIs
        deprecated_list = DEPRECATED_PATTERNS.get(self.lang_key, [])
        for pattern in deprecated_list:
            if pattern.search(line):
                stats.issues.append(Issue(
                    file_path=file_path,
                    line_number=line_no,
                    severity=RiskLevel.MEDIUM,
                    category="deprecated_api",
                    message="Deprecated API usage",
                    detail=pattern.pattern,
                ))

        # Hardcoded URLs (security)
        url_match = URL_PATTERN.search(line)
        if url_match and not line.strip().startswith("#") and not line.strip().startswith("//"):
            url = url_match.group(0)
            is_suspicious = any(s in url.lower() for s in ['api', 'key', 'token', 'auth', 'password'])
            severity = RiskLevel.HIGH if is_suspicious else RiskLevel.LOW
            stats.issues.append(Issue(
                file_path=file_path,
                line_number=line_no,
                severity=severity,
                category="hardcoded_url",
                message="Hardcoded URL",
                detail=url,
            ))

        # Hardcoded API keys/tokens
        for pattern in API_KEY_PATTERNS:
            match = pattern.search(line)
            if match:
                masked = match.group(0)[:10] + "..." if len(match.group(0)) > 10 else match.group(0)
                stats.issues.append(Issue(
                    file_path=file_path,
                    line_number=line_no,
                    severity=RiskLevel.CRITICAL,
                    category="hardcoded_secret",
                    message="Potential hardcoded secret",
                    detail=masked,
                ))


# =============================================================================
# Karmaşıklık Analizi (Complexity Analyzer)
# =============================================================================

class ComplexityAnalyzer:
    """Analyzes cyclomatic complexity of functions across files."""

    def __init__(self):
        self.complexity_threshold = COMPLEXITY_WARNING_THRESHOLD

    def find_complex_functions(
        self, file_stats_list: List[FileStats], top_n: int = 20
    ) -> List[Dict[str, Any]]:
        all_functions: List[Dict[str, Any]] = []
        for fs in file_stats_list:
            for func in fs.functions:
                if func.complexity > self.complexity_threshold:
                    all_functions.append({
                        "file": fs.file_path,
                        "function": func.name,
                        "complexity": func.complexity,
                        "lines": func.line_count,
                        "start_line": func.start_line,
                    })
        all_functions.sort(key=lambda x: x["complexity"], reverse=True)
        return all_functions[:top_n]


# =============================================================================
# Duplicate Kod Dedektörü (Duplicate Detector)
# =============================================================================

class DuplicateDetector:
    """
    Detects duplicate or near-duplicate code blocks using normalized
    token/line-based hashing.
    """

    def __init__(self, window_size: int = DUPLICATE_WINDOW_SIZE,
                 min_matches: int = DUPLICATE_MIN_MATCHES):
        self.window_size = window_size
        self.min_matches = min_matches

    @staticmethod
    def _normalize_line(line: str) -> str:
        stripped = line.strip()
        stripped = re.sub(r'\s+', ' ', stripped)
        stripped = re.sub(r'"[^"]*"', '"STR"', stripped)
        stripped = re.sub(r"'[^']*'", "'STR'", stripped)
        stripped = re.sub(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', 'VAR', stripped)
        stripped = re.sub(r'\b\d+\.?\d*\b', 'NUM', stripped)
        stripped = re.sub(r'\s*([{}()\[\],.;:])\s*', r'\1', stripped)
        return stripped.strip()

    def _compute_hash(self, lines: List[str]) -> str:
        content = "\n".join(lines)
        return hashlib.md5(content.encode("utf-8")).hexdigest()[:12]

    def detect(self, file_path: str, lines: List[str]) -> List[DuplicateMatch]:
        if len(lines) < self.window_size * 2:
            return []

        normalized: List[str] = [self._normalize_line(l) for l in lines]

        window_hashes: Dict[str, List[int]] = defaultdict(list)

        for i in range(len(normalized) - self.window_size + 1):
            window = normalized[i:i + self.window_size]
            if all(l == "" for l in window):
                continue
            h = self._compute_hash(window)
            window_hashes[h].append(i)

        matches: List[DuplicateMatch] = []
        for h, positions in window_hashes.items():
            if len(positions) < self.min_matches:
                continue

            first_start = positions[0]
            last_start = positions[-1]
            end_line = last_start + self.window_size - 1
            actual_lines = lines[first_start:end_line + 1]
            match = DuplicateMatch(
                file_path=file_path,
                start_line=first_start + 1,
                end_line=end_line + 1,
                lines=actual_lines,
                hash_key=h,
                match_count=len(positions),
            )
            matches.append(match)

        matches.sort(key=lambda m: m.match_count, reverse=True)
        return matches


# =============================================================================
# Bağımlılık Analizi (Dependency Analyzer)
# =============================================================================

class DependencyAnalyzer:
    """Analyzes Gradle/Kotlin dependency declarations."""

    SCOPE_KEYWORDS: Dict[str, str] = {
        "implementation": "implementation",
        "api": "api",
        "kapt": "kapt",
        "ksp": "ksp",
        "testImplementation": "testImplementation",
        "androidTestImplementation": "androidTestImplementation",
        "compileOnly": "compileOnly",
        "runtimeOnly": "runtimeOnly",
        "annotationProcessor": "annotationProcessor",
    }

    def analyze(self, file_path: str, lines: List[str]) -> List[Dependency]:
        deps: List[Dependency] = []
        sorted_keywords = sorted(self.SCOPE_KEYWORDS.keys(), key=len, reverse=True)

        for i, line in enumerate(lines):
            stripped = line.strip()
            for scope_kw in sorted_keywords:
                pattern = r'\b' + re.escape(scope_kw) + r'\b'
                if re.search(pattern, stripped):
                    scope_name = self.SCOPE_KEYWORDS[scope_kw]
                    dep = self._parse_dependency_line(stripped, i + 1, scope_name)
                    if dep:
                        deps.append(dep)
                        break

        return deps

    def _parse_dependency_line(
        self, line: str, line_no: int, scope: str
    ) -> Optional[Dependency]:
        patterns = [
            r'"([a-zA-Z0-9_\.\-]+:[a-zA-Z0-9_\.\-]+:[a-zA-Z0-9_\.\-\+]*)"',
            r"'([a-zA-Z0-9_\.\-]+:[a-zA-Z0-9_\.\-]+:[a-zA-Z0-9_\.\-\+]*)'",
            r'([a-zA-Z0-9_\.\-]+:[a-zA-Z0-9_\.\-]+:[a-zA-Z0-9_\.\-\+]*)\s*\{',
        ]
        for pat in patterns:
            match = re.search(pat, line)
            if match:
                coord = match.group(1)
                parts = coord.split(":")
                group = parts[0] if parts else ""
                name = parts[1] if len(parts) > 1 else ""
                version = parts[2] if len(parts) > 2 else ""
                return Dependency(
                    group=group, name=name, scope=scope,
                    line_number=line_no, version=version,
                )
        match = re.search(r'"([a-zA-Z0-9_\.\-]+:[a-zA-Z0-9_\.\-]+)"', line)
        if match:
            parts = match.group(1).split(":")
            return Dependency(
                group=parts[0] if parts else "",
                name=parts[1] if len(parts) > 1 else "",
                scope=scope,
                line_number=line_no,
            )
        return None


# =============================================================================
# Proje Yapısı Analizi (Structure Analyzer)
# =============================================================================

class StructureAnalyzer:
    """Analyzes project directory structure."""

    KEY_DIRS = {"app", "src", "main", "test", "tests", "lib", "libs",
                "resources", "assets", "res", "gradle", ".github"}

    def analyze(self, root_path: str, exclude_dirs: Set[str]) -> Dict[str, Any]:
        root = Path(root_path)
        structure: Dict[str, Any] = {
            "root": str(root),
            "key_directories": [],
            "key_files": [],
            "depth": 0,
            "languages": {},
        }

        lang_counter: Counter = Counter()
        max_depth = 0

        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in exclude_dirs]

            rel_depth = dirpath.replace(str(root), "").count(os.sep)
            max_depth = max(max_depth, rel_depth)

            rel_path = os.path.relpath(dirpath, str(root))

            for d in dirnames:
                if d.lower() in self.KEY_DIRS:
                    structure["key_directories"].append(
                        os.path.join(rel_path, d) if rel_path != "." else d
                    )

            for f in filenames:
                lower = f.lower()
                if lower in ("build.gradle", "build.gradle.kts",
                             "pom.xml", "settings.gradle", "settings.gradle.kts",
                             "Dockerfile", "Makefile", "CMakeLists.txt",
                             "requirements.txt", "setup.py", "setup.cfg",
                             "package.json", "tsconfig.json", ".gitignore"):
                    structure["key_files"].append(
                        os.path.join(rel_path, f) if rel_path != "." else f
                    )

                ext = os.path.splitext(f)[1].lower()
                if ext in SUPPORTED_EXTENSIONS:
                    lang = SUPPORTED_EXTENSIONS[ext]
                    lang_counter[lang] += 1

        structure["depth"] = max_depth
        structure["languages"] = dict(lang_counter)
        return structure


# =============================================================================
# Risk Değerlendirici (Risk Assessor)
# =============================================================================

class RiskAssessor:
    """Assigns risk levels to issues and computes overall risk."""

    @staticmethod
    def assess_issue(issue: Issue) -> RiskLevel:
        return issue.severity

    @staticmethod
    def compute_overall_risk(issues: List[Issue]) -> Tuple[RiskLevel, Dict[str, int]]:
        breakdown: Dict[str, int] = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        for issue in issues:
            breakdown[issue.severity.value] += 1

        if breakdown["CRITICAL"] > 0:
            return RiskLevel.CRITICAL, breakdown
        if breakdown["HIGH"] > 0:
            return RiskLevel.HIGH, breakdown
        if breakdown["MEDIUM"] > 0:
            return RiskLevel.MEDIUM, breakdown
        return RiskLevel.LOW, breakdown

    @staticmethod
    def get_exit_code(risk: RiskLevel) -> int:
        return {
            RiskLevel.LOW: 0,
            RiskLevel.MEDIUM: 0,
            RiskLevel.HIGH: 0,
            RiskLevel.CRITICAL: 2,
        }[risk]


# =============================================================================
# Rapor Üretici (Report Generator)
# =============================================================================

class ReportGenerator:
    """Generates terminal and JSON reports."""

    def generate_terminal_report(self, result: AnalysisResult) -> str:
        lines: List[str] = []
        sep = "=" * 60

        lines.append(sep)
        lines.append("REPO SUMMARY")
        lines.append(sep)
        summary = result.to_dict()["summary"]
        lines.append(f"Files: {summary['files']}")
        lines.append(f"Lines: {summary['lines']:,}")
        lines.append(f"Classes: {summary['classes']}")
        lines.append(f"Functions: {summary['functions']}")
        lines.append(f"Analyzed: {summary['scanned_files']} files "
                      f"({summary['skipped_files']} skipped)")

        risk_level, breakdown = RiskAssessor.compute_overall_risk(result.issues)
        lines.append("")

        lines.append(sep)
        lines.append("RISK SUMMARY")
        lines.append(sep)
        for level in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
            lines.append(f"{level}: {breakdown[level]}")
        lines.append("")

        # Project structure
        if result.project_structure:
            lines.append(sep)
            lines.append("PROJECT STRUCTURE")
            lines.append(sep)
            ps = result.project_structure
            lines.append(f"Languages: {', '.join(f'{k} ({v})' for k, v in ps.get('languages', {}).items())}")
            lines.append(f"Max depth: {ps.get('depth', 0)}")
            if ps.get("key_directories"):
                lines.append(f"Key directories: {', '.join(ps['key_directories'][:10])}")
            if ps.get("key_files"):
                lines.append(f"Key files: {', '.join(ps['key_files'][:10])}")
            lines.append("")

        # Dependencies
        if result.dependencies:
            lines.append(sep)
            lines.append("DEPENDENCIES")
            lines.append(sep)
            total_deps = sum(len(d) for d in result.dependencies.values())
            lines.append(f"Total dependencies: {total_deps}")
            for file_path, deps in result.dependencies.items():
                if deps:
                    lines.append(f"  {os.path.basename(file_path)}: {len(deps)} deps")
                    for dep in deps[:10]:
                        lines.append(f"    [{dep.scope}] {dep.group}:{dep.name}:{dep.version}")
            lines.append("")

        # Top complex functions
        if result.top_complex_functions:
            lines.append(sep)
            lines.append("TOP COMPLEX FUNCTIONS")
            lines.append(sep)
            for func in result.top_complex_functions[:10]:
                lines.append(f"  [{func['complexity']}] {func['function']} "
                              f"({func['lines']} lines) - {func['file']}:{func['start_line']}")
            lines.append("")

        # Duplicates
        if result.duplicates:
            lines.append(sep)
            lines.append("DUPLICATE CODE")
            lines.append(sep)
            lines.append(f"Found {len(result.duplicates)} duplicate block(s)")
            for dup in result.duplicates[:5]:
                lines.append(f"  Matches: {dup.match_count}x at {dup.file_path}:{dup.start_line}-{dup.end_line}")
            lines.append("")

        # Issues by file
        if result.issues:
            lines.append(sep)
            lines.append("ISSUES")
            lines.append(sep)
            issues_by_file: Dict[str, List[Issue]] = defaultdict(list)
            for issue in result.issues:
                issues_by_file[issue.file_path].append(issue)

            for file_path, file_issues in sorted(issues_by_file.items()):
                for issue in file_issues:
                    lines.append(
                        f"  [{issue.severity.value}] {issue.category} "
                        f"at {os.path.basename(file_path)}:{issue.line_number} "
                        f"- {issue.message}"
                    )
            lines.append("")

        # File stats
        lines.append(sep)
        lines.append("FILE STATS")
        lines.append(sep)
        lines.append(f"{'File':<50} {'Lines':>6} {'Code':>6} {'Cmt':>6} {'Blank':>6} {'Fns':>4} {'Cls':>4} {'Imp':>4}")
        lines.append("-" * 90)
        for fs in sorted(result.file_stats, key=lambda f: f.total_lines, reverse=True)[:20]:
            lines.append(
                f"{os.path.basename(fs.file_path)[:47]:<50} "
                f"{fs.total_lines:>6} {fs.code_lines:>6} {fs.comment_lines:>6} "
                f"{fs.blank_lines:>6} {fs.function_count:>4} {fs.class_count:>4} "
                f"{fs.import_count:>4}"
            )
        lines.append("")
        lines.append(f"Overall risk level: {risk_level.value}")

        return "\n".join(lines)

    def generate_json_report(self, result: AnalysisResult) -> str:
        return json.dumps(result.to_dict(), indent=2, ensure_ascii=False)


# =============================================================================
# Proje Tarayıcı (Project Scanner)
# =============================================================================

class ProjectScanner:
    """Scans a project directory and orchestrates analysis."""

    def __init__(self, include_hidden: bool = False, include_build: bool = False):
        self.include_hidden = include_hidden
        self.include_build = include_build
        self.exclude_dirs = self._compute_excludes()

    def _compute_excludes(self) -> Set[str]:
        excludes = set(EXCLUDED_DIRS)
        if self.include_build:
            for d in ("build", "node_modules", ".gradle", "target", "__pycache__",
                      ".venv", "venv", "dist", ".mvn", ".cache"):
                if d in excludes:
                    excludes.discard(d)
        return excludes

    def should_exclude_dir(self, dirname: str) -> bool:
        if dirname in self.exclude_dirs:
            return True
        if not self.include_hidden and dirname.startswith("."):
            return True
        return False

    def should_process_file(self, filename: str) -> bool:
        ext = os.path.splitext(filename)[1].lower()
        if ext not in SUPPORTED_EXTENSIONS:
            return False
        if not self.include_hidden and filename.startswith("."):
            return False
        return True

    def scan(self, root_path: str, analysis_types: Set[AnalysisType]) -> AnalysisResult:
        root_path = os.path.abspath(root_path)
        result = AnalysisResult(project_path=root_path)

        all_issues: List[Issue] = []
        all_stats: List[FileStats] = []

        # Single walk: collect files, count all files, detect excluded dirs
        files_to_process: List[Tuple[str, str]] = []
        all_files_count = 0
        for dirpath, dirnames, filenames in os.walk(root_path):
            # Filter directories and detect excluded dirs
            kept_dirs = []
            for d in dirnames:
                if d in EXCLUDED_DIRS:
                    result.excluded_dirs_found.add(d)
                if not self.should_exclude_dir(d):
                    kept_dirs.append(d)
            dirnames[:] = kept_dirs

            for filename in filenames:
                if not self.include_hidden and filename.startswith("."):
                    continue
                all_files_count += 1
                if self.should_process_file(filename):
                    filepath = os.path.join(dirpath, filename)
                    if os.path.islink(filepath):
                        continue
                    lang_key = SUPPORTED_EXTENSIONS.get(
                        os.path.splitext(filename)[1].lower()
                    )
                    files_to_process.append((filepath, lang_key))

        result.scanned_files = len(files_to_process)
        result.skipped_files = all_files_count - len(files_to_process)

        # Parse files
        dep_analyzer = DependencyAnalyzer()

        for filepath, lang_key in files_to_process:
            stats = self._parse_single_file(filepath, lang_key, analysis_types)
            all_stats.append(stats)

            # Collect issues
            all_issues.extend(stats.issues)

            # Dependencies
            if AnalysisType.DEPENDENCIES in analysis_types or AnalysisType.ALL in analysis_types:
                if lang_key in ("kotlin", "gradle") and os.path.splitext(filepath)[1] in (".gradle", ".kts"):
                    try:
                        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                            lines = f.readlines()
                        deps = dep_analyzer.analyze(filepath, lines)
                        if deps:
                            result.dependencies[filepath] = deps
                    except OSError:
                        pass

        result.file_stats = all_stats
        result.issues = all_issues

        # Duplicates
        if AnalysisType.DUPLICATES in analysis_types or AnalysisType.ALL in analysis_types:
            result.duplicates = self._detect_all_duplicates(all_stats, files_to_process)

        # Complexity
        if AnalysisType.COMPLEXITY in analysis_types or AnalysisType.ALL in analysis_types:
            analyzer = ComplexityAnalyzer()
            result.top_complex_functions = analyzer.find_complex_functions(all_stats)

        # Project structure
        result.project_structure = StructureAnalyzer().analyze(root_path, self.exclude_dirs)

        # If ALL, add complexity issues for high-complexity functions
        if AnalysisType.ALL in analysis_types:
            for func_info in result.top_complex_functions:
                if func_info["complexity"] >= HIGH_COMPLEXITY_THRESHOLD:
                    result.issues.append(Issue(
                        file_path=func_info["file"],
                        line_number=func_info["start_line"],
                        severity=RiskLevel.HIGH,
                        category="high_complexity",
                        message=f"High complexity function: {func_info['function']}",
                        detail=f"Cyclomatic complexity: {func_info['complexity']}",
                    ))
                elif func_info["complexity"] >= MEDIUM_COMPLEXITY_THRESHOLD:
                    result.issues.append(Issue(
                        file_path=func_info["file"],
                        line_number=func_info["start_line"],
                        severity=RiskLevel.MEDIUM,
                        category="medium_complexity",
                        message=f"Medium complexity function: {func_info['function']}",
                        detail=f"Cyclomatic complexity: {func_info['complexity']}",
                    ))

        result.issues.sort(key=lambda x: (-x.severity.severity, x.file_path, x.line_number))

        return result

    def _parse_single_file(
        self, filepath: str, lang_key: str, analysis_types: Set[AnalysisType]
    ) -> FileStats:
        parser = FileParser(lang_key or "python")
        stats = parser.parse_file(filepath)
        return stats

    def _detect_all_duplicates(
        self, file_stats: List[FileStats], files_to_process: List[Tuple[str, str]]
    ) -> List[DuplicateMatch]:
        detector = DuplicateDetector()
        all_matches: List[DuplicateMatch] = []
        for filepath, lang_key in files_to_process:
            if lang_key in ("json", "markdown"):
                continue
            try:
                with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                    lines = f.readlines()
            except OSError:
                continue
            matches = detector.detect(filepath, lines)
            all_matches.extend(matches)
        all_matches.sort(key=lambda m: m.match_count, reverse=True)
        return all_matches[:50]


# =============================================================================
# Git Klonlama (Git Cloner)
# =============================================================================

class GitCloner:
    """Clones a Git repository to a temporary directory."""

    @staticmethod
    def is_url(path: str) -> bool:
        if path.endswith('.git'):
            return True
        if path.startswith(('http://', 'https://', 'git://', 'ssh://')):
            return True
        if path.startswith('git@'):
            return True
        return False

    @staticmethod
    def clone(repo_url: str) -> Optional[str]:
        temp_dir = tempfile.mkdtemp(prefix="repomind_")
        try:
            result = subprocess.run(
                ["git", "clone", "--depth", "1", repo_url, temp_dir],
                capture_output=True,
                text=True,
                timeout=300,
            )
            if result.returncode != 0:
                # Try full clone
                result = subprocess.run(
                    ["git", "clone", repo_url, temp_dir],
                    capture_output=True,
                    text=True,
                    timeout=600,
                )
            if result.returncode != 0:
                print(f"Git clone failed: {result.stderr.strip()}", file=sys.stderr)
                shutil.rmtree(temp_dir, ignore_errors=True)
                return None
            return temp_dir
        except (subprocess.TimeoutExpired, FileNotFoundError) as e:
            print(f"Git clone error: {e}", file=sys.stderr)
            shutil.rmtree(temp_dir, ignore_errors=True)
            return None


# =============================================================================
# CLI (Komut Satırı Arayüzü)
# =============================================================================

def parse_args(argv: Optional[List[str]] = None) -> Tuple[argparse.Namespace, argparse.ArgumentParser]:
    parser = argparse.ArgumentParser(
        prog="repomind",
        description="RepoMind - Automatic Code Quality & Structure Analyzer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 repomind.py /path/to/project
  python3 repomind.py /path/to/project --all
  python3 repomind.py https://github.com/user/repo.git --all --json report.json
  python3 repomind.py /path/to/project --stats --complexity --json out.json
        """,
    )

    parser.add_argument(
        "target",
        help="Path to project directory or Git repository URL",
    )
    parser.add_argument(
        "--stats", action="store_true", help="Collect file statistics"
    )
    parser.add_argument(
        "--security", action="store_true",
        help="Detect hardcoded secrets, URLs (security)"
    )
    parser.add_argument(
        "--duplicates", action="store_true",
        help="Detect duplicate code blocks"
    )
    parser.add_argument(
        "--complexity", action="store_true",
        help="Analyze cyclomatic complexity"
    )
    parser.add_argument(
        "--dependencies", action="store_true",
        help="Analyze Gradle/Kotlin dependencies"
    )
    parser.add_argument(
        "--todos", action="store_true",
        help="Detect TODO/FIXME/HACK/XXX and other markers"
    )
    parser.add_argument(
        "--all", action="store_true",
        help="Run all analyses"
    )
    parser.add_argument(
        "--json", metavar="FILE",
        help="Write JSON report to FILE"
    )
    parser.add_argument(
        "--include-hidden", action="store_true",
        help="Include hidden directories and files"
    )
    parser.add_argument(
        "--include-build", action="store_true",
        help="Include build output directories (node_modules, build, etc.)"
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Verbose output"
    )
    parser.add_argument(
        "--quiet", "-q", action="store_true",
        help="Suppress non-essential output"
    )

    args = parser.parse_args(argv)

    # If no analysis type specified, default to ALL
    if not any([args.stats, args.security, args.duplicates,
                args.complexity, args.dependencies, args.todos, args.all]):
        args.all = True

    return args, parser


def resolve_target(target: str) -> Tuple[Optional[str], Optional[str]]:
    """Resolve target to a local path."""
    if GitCloner.is_url(target):
        temp_dir = GitCloner.clone(target)
        if temp_dir is None:
            return None, "Failed to clone repository"
        return temp_dir, None

    path = os.path.abspath(target)
    if not os.path.exists(path):
        return None, f"Path does not exist: {path}"
    if not os.path.isdir(path):
        parent = os.path.dirname(path)
        if os.path.isdir(parent):
            return parent, None
        return None, f"Not a directory: {path}"
    return path, None


def run_analysis(
    target: str,
    analysis_types: Set[AnalysisType],
    include_hidden: bool = False,
    include_build: bool = False,
    verbose: bool = False,
    quiet: bool = False,
) -> AnalysisResult:
    scanner = ProjectScanner(
        include_hidden=include_hidden,
        include_build=include_build,
    )
    return scanner.scan(target, analysis_types)


def main(argv: Optional[List[str]] = None) -> int:
    args, parser = parse_args(argv)

    # Resolve target
    local_path, error = resolve_target(args.target)
    if local_path is None:
        print(f"Error: {error}", file=sys.stderr)
        parser.print_help(sys.stderr)
        return 1

    is_temp = local_path != os.path.abspath(args.target) and GitCloner.is_url(args.target)
    temp_dir = local_path if is_temp else None

    try:
        # Build analysis type set
        analysis_types: Set[AnalysisType] = set()
        if args.all:
            analysis_types.add(AnalysisType.ALL)
        else:
            for attr in ["stats", "security", "duplicates",
                         "complexity", "dependencies", "todos"]:
                if getattr(args, attr):
                    analysis_types.add(AnalysisType[attr.upper()])

        result = run_analysis(
            local_path,
            analysis_types,
            include_hidden=args.include_hidden,
            include_build=args.include_build,
            verbose=args.verbose,
            quiet=args.quiet,
        )

        risk_level, _ = RiskAssessor.compute_overall_risk(result.issues)
        reporter = ReportGenerator()

        if args.json:
            json_report = reporter.generate_json_report(result)
            try:
                with open(args.json, "w", encoding="utf-8") as f:
                    f.write(json_report)
                if not args.quiet:
                    print(f"JSON report written to: {args.json}", file=sys.stderr)
            except OSError as e:
                print(f"Error writing JSON: {e}", file=sys.stderr)
                return 1

        if not args.quiet:
            report = reporter.generate_terminal_report(result)
            print(report)

        return RiskAssessor.get_exit_code(risk_level)

    finally:
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
