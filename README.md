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

## Status

DevRadar is under active development. The first usable release is being built in seven incremental phases. This file will be expanded with examples and full option documentation as each phase lands.

## Requirements

- Node.js 18 or newer

## Installation

From source:

    git clone https://github.com/hasoftware/DevRadar.git
    cd DevRadar
    npm install
    npm install -g .

After global installation the `devradar` command is available from any directory.

## Usage

    devradar <path>

Common options:

    devradar . --pure-code            Exclude comments and blank lines from totals
    devradar . --advanced             Add per-file statistics to the report
    devradar . --tech-only            Show only language and framework detection
    devradar . --output report.json   Write the report to a file
    devradar . --format csv           Choose output format: terminal, json, or csv
    devradar . --exclude "test/**"    Add custom exclude patterns (repeatable)
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
