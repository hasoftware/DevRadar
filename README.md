# DevRadar

A command-line tool to analyze code projects: count lines of code, detect programming languages, and identify frameworks in use.

DevRadar is a fast, read-only inspector. It walks a project directory, ignores third-party dependencies, and produces a clean report of what a codebase is made of.

## Features

- Count total lines of code, with optional exclusion of comments and blank lines
- Detect programming languages from file extensions and content
- Identify frameworks and libraries from project manifests
- Per-file advanced analysis mode
- Respect the project's .gitignore and exclude common dependency directories
- Export reports as JSON or CSV
- Read-only by design: DevRadar never modifies the project being analyzed
- Monorepo support: detect and analyze workspaces separately
- Compare mode: diff current results against a previous JSON report
- Remote Git URL support: analyze any public repository by URL
- Interactive mode: guided option selection via terminal prompts
- Visual bar chart showing language distribution
- Config file support (.devradarrc.json) for project-level defaults
- Sortable tables by name, lines, code, or file count

## Requirements

- Node.js 18 or newer
- Optional: [tokei](https://github.com/XAMPPRocky/tokei) or [cloc](https://github.com/AlDanial/cloc) for faster and more accurate line counting. DevRadar auto-detects them and falls back to its built-in counter if neither is installed.

## Line Counting Engines

DevRadar delegates the actual line counting to the first available tool in this order:

1. **tokei** if found on PATH (fast, Rust)
2. **cloc** if found on PATH (mature, Perl)
3. **Built-in counter** as a zero-dependency fallback

Framework detection, manifest parsing, and report formatting are always done by DevRadar itself. The selected engine is printed at the top of every report so you know which one produced the numbers.

You can force a specific engine with `--tokei`, `--cloc`, or `--builtin`. If the requested engine is not installed, DevRadar exits with a clear message instead of silently falling back.

When the target project is a git repository, the cloc engine automatically uses `cloc --vcs=git` so that the file list is taken from `git ls-files`. This makes cloc and tokei produce comparable numbers because both honor `.gitignore`.

## Installation

From npm:

    npm install -g @hasoftware/devradar

From source:

    git clone https://github.com/hasoftware/DevRadar.git
    cd DevRadar
    npm install
    npm install -g .

After global installation the `devradar` command is available from any directory.

## Usage

    devradar              # analyze the current directory
    devradar <path>       # analyze a specific path

Common options:

    devradar . --pure-code            Exclude comments and blank lines from totals
    devradar . --advanced             Add per-file statistics to the report
    devradar . --tech-only            Show only language and framework detection
    devradar . --output report.json   Write the report to a file
    devradar . --format csv           Choose output format: terminal, json, or csv
    devradar . --exclude "test/**"    Add custom exclude patterns (repeatable)
    devradar . --tokei                Force the tokei engine
    devradar . --cloc                 Force the cloc engine
    devradar . --builtin              Force the built-in engine (no external tool)
    devradar . --sort code            Sort tables by name, lines, code, or files
    devradar . --monorepo             Detect and analyze workspaces separately
    devradar . --compare prev.json    Compare against a previous JSON report
    devradar . --interactive          Launch interactive mode for guided setup
    devradar https://github.com/user/repo   Analyze a remote Git repository
    devradar --help                   Show help
    devradar --version                Show version

When `--output` is given without `--format`, the format is inferred from the file extension (.json or .csv); otherwise the default is `terminal`.

### Example

    $ devradar .

    DevRadar Analysis
    Project: /home/dev/example-app
    Scanned: 2026-05-14T08:55:39Z

    Technologies
    Frameworks       : Express, React
    Package managers : npm
    Build tools      : Vite
    Databases        : PostgreSQL

    Summary
    Files:    142
    Total:    8,432 lines
    Code:     6,210
    Comments: 1,022
    Blank:    1,200

    By Language
    +------------+-------+-------+-------+----------+-------+
    | Language   | Files | Total | Code  | Comments | Blank |
    +------------+-------+-------+-------+----------+-------+
    | JavaScript |    80 | 4,500 | 3,200 |      600 |   700 |
    | TypeScript |    32 | 2,100 | 1,500 |      280 |   320 |
    +------------+-------+-------+-------+----------+-------+

### Config File

Place a `.devradarrc.json` in your project root to set default options:

    {
      "pureCode": true,
      "sort": "code",
      "exclude": ["test/**", "docs/**"]
    }

CLI flags override config file values.

### Environment variables

- `DEVRADAR_DEBUG=1` prints a full stack trace when an error occurs.

## Supported Languages

JavaScript, TypeScript, Python, Java, C, C++, C#, Go, Rust, PHP, Ruby, Swift, Kotlin, Dart, Scala, R, Lua, Perl, Shell, PowerShell, SQL, HTML, CSS, SCSS, Vue, Svelte, and more.

## Supported Frameworks

- Node.js: React, Vue, Angular, Next.js, Express, NestJS, and others
- Python: Django, Flask, FastAPI, and others
- Java: Spring and other Maven or Gradle projects
- Go: standard module detection through go.mod
- Rust: standard crate detection through Cargo.toml
- PHP: Laravel, Symfony, and others
- Ruby: Rails, Sinatra, and others
- .NET: csproj and sln based projects
- Dart and Flutter through pubspec.yaml

## Contributing

Contributions are welcome through pull requests. By submitting code you agree that it may be redistributed under the HASOFTWARE Custom License.

1. Fork the repository
2. Create a feature branch
3. Open a pull request with a clear description of the change

Bug reports and feature requests can be filed as GitHub issues.

## License

DevRadar is released under the HASOFTWARE Custom License. See the LICENSE file for the full terms. In short, personal and lawful commercial use are permitted, while redistribution under a different name, use in malware or illegal activities, and copying portions of the code into a derivative product without explicit permission are prohibited.

## Contact

- Telegram: https://t.me/hasoftware
- Repository: https://github.com/hasoftware/DevRadar

## About HASOFTWARE

HASOFTWARE is a software development group focused on building practical tools for engineers. DevRadar is one of our open projects, aimed at giving developers a fast and accurate view of any codebase they are working with.
