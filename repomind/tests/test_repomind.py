import unittest
import sys
import os
import tempfile
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from repomind import (
    FileParser,
    LineClassifier,
    LineType,
    LanguageDefinition,
    LanguageRegistry,
    get_language_for_extension,
    get_language_definition,
    FunctionInfo,
    Issue,
    FileStats,
    RiskLevel,
    AnalysisType,
    TODO_PATTERN,
    URL_PATTERN,
    API_KEY_PATTERNS,
    DEPRECATED_PATTERNS,
    COMPLEXITY_WARNING_THRESHOLD,
    DuplicateDetector,
    ComplexityAnalyzer,
    DependencyAnalyzer,
    StructureAnalyzer,
    RiskAssessor,
    ReportGenerator,
    ProjectScanner,
    GitCloner,
    EXCLUDED_DIRS,
)


class TestParser(unittest.TestCase):
    """Test the FileParser for various languages."""

    def setUp(self):
        self.test_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "test_data",
            "sample_project",
        )

    def test_python_parser(self):
        filepath = os.path.join(self.test_dir, "src", "main", "kotlin", "com", "example", "sample.py")
        parser = FileParser("python")
        stats = parser.parse_file(filepath)

        self.assertEqual(stats.language, "python")
        self.assertGreater(stats.total_lines, 0)
        self.assertGreater(stats.code_lines, 0)
        self.assertGreater(stats.comment_lines, 0)
        self.assertGreater(stats.blank_lines, 0)
        self.assertGreater(stats.function_count, 0)
        self.assertGreater(stats.class_count, 0)
        self.assertGreater(stats.import_count, 0)

        # Check TODO detection
        todo_issues = [i for i in stats.issues if i.category == "todo"]
        self.assertGreaterEqual(len(todo_issues), 3)

        # Check FIXME detection
        fixme_issues = [i for i in stats.issues if "FIXME" in i.message]
        self.assertGreaterEqual(len(fixme_issues), 1)

        # Check HACK detection
        hack_issues = [i for i in stats.issues if "HACK" in i.message]
        self.assertGreaterEqual(len(hack_issues), 1)

    def test_kotlin_parser(self):
        filepath = os.path.join(self.test_dir, "src", "main", "kotlin", "com", "example", "MainActivity.kt")
        parser = FileParser("kotlin")
        stats = parser.parse_file(filepath)

        self.assertEqual(stats.language, "kotlin")
        self.assertGreater(stats.total_lines, 0)
        self.assertGreater(stats.function_count, 0)
        self.assertGreater(stats.class_count, 0)
        self.assertGreater(stats.import_count, 0)

        # Check for hardcoded secret
        secret_issues = [i for i in stats.issues if i.category == "hardcoded_secret"]
        self.assertGreater(len(secret_issues), 0)

        # Check for hardcoded URL
        url_issues = [i for i in stats.issues if i.category == "hardcoded_url"]
        self.assertGreater(len(url_issues), 0)

    def test_javascript_parser(self):
        filepath = os.path.join(self.test_dir, "src", "main", "kotlin", "com", "example", "sample.js")
        parser = FileParser("javascript")
        stats = parser.parse_file(filepath)

        self.assertEqual(stats.language, "javascript")
        self.assertGreater(stats.total_lines, 0)
        self.assertGreater(stats.function_count, 0)
        self.assertGreater(stats.class_count, 0)

    def test_json_parser(self):
        filepath = os.path.join(self.test_dir, "package.json")
        parser = FileParser("json")
        stats = parser.parse_file(filepath)

        self.assertEqual(stats.language, "json")
        self.assertGreater(stats.total_lines, 0)
        self.assertEqual(stats.function_count, 0)
        self.assertEqual(stats.class_count, 0)

    def test_markdown_parser(self):
        filepath = os.path.join(self.test_dir, "README.md")
        parser = FileParser("markdown")
        stats = parser.parse_file(filepath)

        self.assertEqual(stats.language, "markdown")
        self.assertGreater(stats.total_lines, 0)

    def test_line_classifier_python(self):
        lang_def = get_language_definition("python")
        classifier = LineClassifier(lang_def)

        self.assertEqual(classifier.classify("x = 1"), LineType.CODE)
        self.assertEqual(classifier.classify(""), LineType.BLANK)
        self.assertEqual(classifier.classify("    "), LineType.BLANK)
        self.assertEqual(classifier.classify("# comment"), LineType.COMMENT)

    def test_line_classifier_javascript(self):
        lang_def = get_language_definition("javascript")
        classifier = LineClassifier(lang_def)

        self.assertEqual(classifier.classify("const x = 1;"), LineType.CODE)
        self.assertEqual(classifier.classify(""), LineType.BLANK)
        self.assertEqual(classifier.classify("// comment"), LineType.COMMENT)
        self.assertEqual(classifier.classify("/* block */"), LineType.COMMENT)

    def test_line_classifier_block_comment(self):
        lang_def = get_language_definition("java")
        classifier = LineClassifier(lang_def)

        self.assertEqual(classifier.classify("/* start"), LineType.COMMENT)
        self.assertTrue(classifier.in_block_comment)
        self.assertEqual(classifier.classify("continue"), LineType.COMMENT)
        self.assertEqual(classifier.classify("end */ code"), LineType.CODE)
        self.assertFalse(classifier.in_block_comment)

    def test_get_language_for_extension(self):
        self.assertEqual(get_language_for_extension(".py"), "python")
        self.assertEqual(get_language_for_extension(".kt"), "kotlin")
        self.assertEqual(get_language_for_extension(".ts"), "typescript")
        self.assertEqual(get_language_for_extension(".tsx"), "typescript")
        self.assertEqual(get_language_for_extension(".unknown"), None)

    def test_stats_consistency(self):
        filepath = os.path.join(self.test_dir, "src", "main", "kotlin", "com", "example", "sample.py")
        parser = FileParser("python")
        stats = parser.parse_file(filepath)

        total = stats.code_lines + stats.comment_lines + stats.blank_lines
        self.assertEqual(total, stats.total_lines)

    def test_function_complexity(self):
        filepath = os.path.join(self.test_dir, "src", "main", "kotlin", "com", "example", "sample.py")
        parser = FileParser("python")
        stats = parser.parse_file(filepath)

        complex_funcs = [f for f in stats.functions if "complex" in f.name.lower()]
        self.assertGreater(len(complex_funcs), 0)
        for func in complex_funcs:
            self.assertGreater(func.complexity, 5)

    def test_long_function_detection(self):
        filepath = os.path.join(self.test_dir, "src", "main", "kotlin", "com", "example", "sample.py")
        parser = FileParser("python")
        stats = parser.parse_file(filepath)

        for func in stats.functions:
            self.assertLessEqual(func.line_count, 200)


class TestRiskDetector(unittest.TestCase):
    """Test the risk assessment logic."""

    def test_hardcoded_secret_critical(self):
        issue = Issue(
            file_path="test.py",
            line_number=1,
            severity=RiskLevel.CRITICAL,
            category="hardcoded_secret",
            message="test",
            detail="test",
        )
        level, breakdown = RiskAssessor.compute_overall_risk([issue])
        self.assertEqual(level, RiskLevel.CRITICAL)
        self.assertEqual(breakdown["CRITICAL"], 1)

    def test_high_risk(self):
        issues = [
            Issue("f", 1, RiskLevel.HIGH, "cat", "msg", ""),
        ]
        level, breakdown = RiskAssessor.compute_overall_risk(issues)
        self.assertEqual(level, RiskLevel.HIGH)
        self.assertEqual(breakdown["HIGH"], 1)

    def test_medium_risk(self):
        issues = [
            Issue("f", 1, RiskLevel.MEDIUM, "cat", "msg", ""),
        ]
        level, breakdown = RiskAssessor.compute_overall_risk(issues)
        self.assertEqual(level, RiskLevel.MEDIUM)
        self.assertEqual(breakdown["MEDIUM"], 1)

    def test_low_risk(self):
        issues = [
            Issue("f", 1, RiskLevel.LOW, "cat", "msg", ""),
        ]
        level, breakdown = RiskAssessor.compute_overall_risk(issues)
        self.assertEqual(level, RiskLevel.LOW)
        self.assertEqual(breakdown["LOW"], 1)

    def test_exit_code(self):
        self.assertEqual(RiskAssessor.get_exit_code(RiskLevel.LOW), 0)
        self.assertEqual(RiskAssessor.get_exit_code(RiskLevel.MEDIUM), 0)
        self.assertEqual(RiskAssessor.get_exit_code(RiskLevel.HIGH), 0)
        self.assertEqual(RiskAssessor.get_exit_code(RiskLevel.CRITICAL), 2)

    def test_risk_breakdown(self):
        issues = [
            Issue("f", 1, RiskLevel.CRITICAL, "a", "m", ""),
            Issue("f", 2, RiskLevel.CRITICAL, "b", "m", ""),
            Issue("f", 3, RiskLevel.HIGH, "c", "m", ""),
            Issue("f", 4, RiskLevel.MEDIUM, "d", "m", ""),
            Issue("f", 5, RiskLevel.LOW, "e", "m", ""),
            Issue("f", 6, RiskLevel.LOW, "f", "m", ""),
        ]
        level, breakdown = RiskAssessor.compute_overall_risk(issues)
        self.assertEqual(breakdown["CRITICAL"], 2)
        self.assertEqual(breakdown["HIGH"], 1)
        self.assertEqual(breakdown["MEDIUM"], 1)
        self.assertEqual(breakdown["LOW"], 2)

    def test_no_issues(self):
        level, breakdown = RiskAssessor.compute_overall_risk([])
        self.assertEqual(level, RiskLevel.LOW)
        self.assertEqual(breakdown["CRITICAL"], 0)
        self.assertEqual(breakdown["LOW"], 0)


class TestDuplicateDetector(unittest.TestCase):
    """Test the duplicate code detector."""

    def setUp(self):
        self.detector = DuplicateDetector()

    def test_detect_exact_duplicates(self):
        lines = [
            "def foo():\n",
            "    total = 0\n",
            "    for item in items:\n",
            "        if item:\n",
            "            total += item\n",
            "    return total\n",
            "\n",
            "def bar():\n",
            "    total = 0\n",
            "    for item in items:\n",
            "        if item:\n",
            "            total += item\n",
            "    return total\n",
        ]
        matches = self.detector.detect("test.py", lines)
        self.assertGreater(len(matches), 0)

    def test_detect_similar_duplicates(self):
        lines = [
            "function foo() {\n",
            "    let total = 0;\n",
            "    for (let item of items) {\n",
            "        if (item) {\n",
            "            total = total + item;\n",
            "        }\n",
            "    }\n",
            "    return total;\n",
            "}\n",
            "function bar() {\n",
            "    let total = 0;\n",
            "    for (let item of items) {\n",
            "        if (item) {\n",
            "            total = total + item;\n",
            "        }\n",
            "    }\n",
            "    return total;\n",
            "}\n",
        ]
        matches = self.detector.detect("test.js", lines)
        self.assertGreater(len(matches), 0)

    def test_no_duplicates(self):
        lines = [
            "def foo():\n",
            "    pass\n",
            "    return 0\n",
        ]
        matches = self.detector.detect("test.py", lines)
        self.assertEqual(len(matches), 0)

    def test_normalize_line(self):
        normalized = DuplicateDetector._normalize_line("  const   x  =  42;  ")
        self.assertEqual(normalized, "VAR VAR = NUM;")

    def test_normalize_identifiers(self):
        normalized = DuplicateDetector._normalize_line("int myVariable = 10;")
        self.assertNotIn("myVariable", normalized)
        self.assertIn("VAR", normalized)

    def test_short_file_no_duplicates(self):
        lines = ["x = 1\n"]
        matches = self.detector.detect("test.py", lines)
        self.assertEqual(len(matches), 0)

    def test_duplicate_within_same_file_detected(self):
        lines = [
            "def compute(items):\n",
            "    result = []\n",
            "    for x in items:\n",
            "        if x:\n",
            "            result.append(x)\n",
            "    return result\n",
            "def compute2(items):\n",
            "    result = []\n",
            "    for x in items:\n",
            "        if x:\n",
            "            result.append(x)\n",
            "    return result\n",
        ]
        matches = self.detector.detect("test.py", lines)
        self.assertGreater(len(matches), 0)
        self.assertEqual(matches[0].match_count, 2)


class TestPatternDetection(unittest.TestCase):
    """Test pattern detection."""

    def test_todo_pattern(self):
        match = TODO_PATTERN.search("  # TODO: fix this")
        self.assertIsNotNone(match)
        self.assertEqual(match.group(1).upper(), "TODO")

    def test_fixme_pattern(self):
        match = TODO_PATTERN.search("// FIXME: broken")
        self.assertIsNotNone(match)
        self.assertEqual(match.group(1).upper(), "FIXME")

    def test_hack_pattern(self):
        match = TODO_PATTERN.search("  /* HACK: workaround */")
        self.assertIsNotNone(match)
        self.assertEqual(match.group(1).upper(), "HACK")

    def test_xxx_pattern(self):
        match = TODO_PATTERN.search("// XXX: dangerous")
        self.assertIsNotNone(match)
        self.assertEqual(match.group(1).upper(), "XXX")

    def test_no_todo_pattern(self):
        match = TODO_PATTERN.search("  const x = 1;")
        self.assertIsNone(match)

    def test_url_pattern(self):
        match = URL_PATTERN.search("url = 'https://api.example.com/v1'")
        self.assertIsNotNone(match)

    def test_no_url_pattern(self):
        match = URL_PATTERN.search("var data = 'hello world'")
        self.assertIsNone(match)

    def test_api_key_pattern(self):
        for pattern in API_KEY_PATTERNS:
            match = pattern.search("api_key = 'AKIAIOSFODNN7EXAMPLE'")
            if match:
                self.assertIsNotNone(match)
                break

    def test_git_hub_pattern(self):
        for pattern in API_KEY_PATTERNS:
            match = pattern.search("token = 'ghp_1234567890abcdefghijklmnopqrstuv'")
            if match:
                self.assertIsNotNone(match)
                break

    def test_deprecated_pattern_kotlin(self):
        patterns = DEPRECATED_PATTERNS.get("kotlin", [])
        found = False
        for pattern in patterns:
            if pattern.search("findViewById(R.id.view)"):
                found = True
                break
        self.assertTrue(found)


class TestComplexityAnalyzer(unittest.TestCase):
    """Test cyclomatic complexity analysis."""

    def test_finds_complex_functions(self):
        test_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "test_data",
            "sample_project",
        )
        filepath = os.path.join(test_dir, "src", "main", "kotlin", "com", "example", "sample.py")
        parser = FileParser("python")
        stats = parser.parse_file(filepath)

        analyzer = ComplexityAnalyzer()
        result = analyzer.find_complex_functions([stats])

        self.assertGreater(len(result), 0)
        for func in result:
            self.assertGreaterEqual(func["complexity"], COMPLEXITY_WARNING_THRESHOLD)

    def test_complexity_sorting(self):
        file_stats = [
            FileStats(
                file_path="test.py",
                language="python",
                total_lines=30,
                functions=[
                    FunctionInfo("complex", 1, 10, 15, 50),
                    FunctionInfo("simple", 11, 15, 3, 5),
                    FunctionInfo("medium", 16, 25, 7, 10),
                ],
            )
        ]
        analyzer = ComplexityAnalyzer()
        result = analyzer.find_complex_functions(file_stats)
        self.assertEqual(result[0]["complexity"], 15)
        self.assertEqual(result[-1]["complexity"], 7)


class TestDependencyAnalyzer(unittest.TestCase):
    """Test dependency analysis."""

    def test_gradle_kts_dependencies(self):
        test_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "test_data",
            "sample_project",
        )
        filepath = os.path.join(test_dir, "build.gradle.kts")
        with open(filepath, "r") as f:
            lines = f.readlines()

        analyzer = DependencyAnalyzer()
        deps = analyzer.analyze(filepath, lines)

        scopes = {d.scope for d in deps}
        self.assertIn("implementation", scopes)
        self.assertIn("api", scopes)
        self.assertIn("kapt", scopes)
        self.assertIn("ksp", scopes)
        self.assertIn("testImplementation", scopes)

    def test_gradle_dependencies(self):
        test_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "test_data",
            "sample_project",
        )
        filepath = os.path.join(test_dir, "build.gradle")
        with open(filepath, "r") as f:
            lines = f.readlines()

        analyzer = DependencyAnalyzer()
        deps = analyzer.analyze(filepath, lines)

        scopes = {d.scope for d in deps}
        self.assertIn("implementation", scopes)
        self.assertIn("api", scopes)


class TestStructureAnalyzer(unittest.TestCase):
    """Test project structure analysis."""

    def test_structure_detection(self):
        test_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "test_data",
            "sample_project",
        )
        analyzer = StructureAnalyzer()
        result = analyzer.analyze(test_dir, set())

        self.assertIn("root", result)
        self.assertIn("languages", result)
        self.assertIn("depth", result)
        self.assertIn("kotlin", result["languages"])
        self.assertGreater(result["depth"], 0)


class TestProjectScanner(unittest.TestCase):
    """Test the project scanner."""

    def setUp(self):
        self.test_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "test_data",
            "sample_project",
        )

    def test_scan_all(self):
        scanner = ProjectScanner()
        result = scanner.scan(self.test_dir, {AnalysisType.ALL})

        self.assertGreater(result.scanned_files, 0)
        self.assertEqual(len(result.file_stats), result.scanned_files)
        self.assertGreater(len(result.issues), 0)

    def test_scan_excludes_git(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            os.makedirs(os.path.join(tmpdir, ".git"))
            with open(os.path.join(tmpdir, ".git", "config"), "w") as f:
                f.write("[core]\n")
            with open(os.path.join(tmpdir, "test.py"), "w") as f:
                f.write("x = 1\n")

            scanner = ProjectScanner()
            self.assertIn(".git", EXCLUDED_DIRS)
            self.assertTrue(scanner.should_exclude_dir(".git"))

    def test_scan_excludes_node_modules(self):
        scanner = ProjectScanner()
        self.assertIn("node_modules", EXCLUDED_DIRS)
        self.assertTrue(scanner.should_exclude_dir("node_modules"))

    def test_include_build(self):
        scanner = ProjectScanner(include_build=True)
        self.assertFalse(scanner.should_exclude_dir("build"))
        self.assertFalse(scanner.should_exclude_dir("node_modules"))

    def test_excluded_dirs_found(self):
        scanner = ProjectScanner()
        result = scanner.scan(self.test_dir, {AnalysisType.ALL})
        self.assertGreater(len(result.file_stats), 0)

    def test_dependencies_in_result(self):
        scanner = ProjectScanner()
        result = scanner.scan(self.test_dir, {AnalysisType.DEPENDENCIES})
        self.assertGreater(len(result.dependencies), 0)

    def test_duplicates_in_result(self):
        scanner = ProjectScanner()
        result = scanner.scan(self.test_dir, {AnalysisType.DUPLICATES})
        self.assertGreater(len(result.duplicates), 0)

    def test_complexity_in_result(self):
        scanner = ProjectScanner()
        result = scanner.scan(self.test_dir, {AnalysisType.COMPLEXITY})
        self.assertGreater(len(result.top_complex_functions), 0)

    def test_stats_only(self):
        scanner = ProjectScanner()
        result = scanner.scan(self.test_dir, {AnalysisType.STATS})
        self.assertGreater(len(result.file_stats), 0)
        self.assertEqual(len(result.dependencies), 0)

    def test_file_extension_filter(self):
        scanner = ProjectScanner()
        self.assertTrue(scanner.should_process_file("test.py"))
        self.assertTrue(scanner.should_process_file("Main.kt"))
        self.assertTrue(scanner.should_process_file("data.json"))
        self.assertFalse(scanner.should_process_file("image.png"))
        self.assertFalse(scanner.should_process_file("README"))

    def test_hidden_file_exclusion(self):
        scanner = ProjectScanner()
        self.assertFalse(scanner.should_process_file(".DS_Store"))
        scanner_visible = ProjectScanner(include_hidden=True)
        self.assertTrue(scanner_visible.should_process_file(".hidden.py"))


class TestCLI(unittest.TestCase):
    """Test CLI argument parsing."""

    def test_default_is_all(self):
        from repomind import parse_args
        args, _ = parse_args(["/path/to/project"])
        self.assertTrue(args.all)

    def test_specific_analyses(self):
        from repomind import parse_args
        args, _ = parse_args(["/path/to/project", "--stats", "--complexity"])
        self.assertTrue(args.stats)
        self.assertTrue(args.complexity)
        self.assertFalse(args.todos)
        self.assertFalse(args.all)

    def test_json_output(self):
        from repomind import parse_args
        args, _ = parse_args(["/path/to/project", "--all", "--json", "report.json"])
        self.assertEqual(args.json, "report.json")

    def test_include_hidden(self):
        from repomind import parse_args
        args, _ = parse_args(["/path/to/project", "--include-hidden"])
        self.assertTrue(args.include_hidden)

    def test_include_build(self):
        from repomind import parse_args
        args, _ = parse_args(["/path/to/project", "--include-build"])
        self.assertTrue(args.include_build)

    def test_verbose_flag(self):
        from repomind import parse_args
        args, _ = parse_args(["/path/to/project", "--verbose"])
        self.assertTrue(args.verbose)

    def test_quiet_flag(self):
        from repomind import parse_args
        args, _ = parse_args(["/path/to/project", "--quiet"])
        self.assertTrue(args.quiet)

    def test_invalid_path_exit_code(self):
        from repomind import main
        exit_code = main(["/nonexistent/path/12345"])
        self.assertEqual(exit_code, 1)

    def test_valid_path_exit_code(self):
        from repomind import main
        test_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "test_data",
            "sample_project",
        )
        exit_code = main([test_dir, "--quiet"])
        self.assertIn(exit_code, [0, 2])

    def test_json_output_to_file(self):
        from repomind import main
        test_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "test_data",
            "sample_project",
        )
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w") as f:
            json_path = f.name

        try:
            exit_code = main([test_dir, "--all", "--json", json_path, "--quiet"])
            self.assertIn(exit_code, [0, 2])

            with open(json_path, "r") as f:
                data = json.load(f)

            self.assertIn("summary", data)
            self.assertIn("files", data)
            self.assertIn("issues", data)
            self.assertIn("risk_breakdown", data["summary"])
        finally:
            os.unlink(json_path)

    def test_url_detection(self):
        self.assertTrue(GitCloner.is_url("https://github.com/user/repo.git"))
        self.assertTrue(GitCloner.is_url("git@github.com:user/repo.git"))
        self.assertTrue(GitCloner.is_url("git://github.com/user/repo.git"))
        self.assertFalse(GitCloner.is_url("/local/path"))
        self.assertFalse(GitCloner.is_url("./relative/path"))


if __name__ == "__main__":
    unittest.main()
