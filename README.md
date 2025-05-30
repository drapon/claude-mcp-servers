# Claude 拡張機能設定ツール

このリポジトリは、Claude デスクトップアプリ、Cursor IDE、**Claude Code**の機能拡張設定を管理するためのツールです。

## 概要

`Makefile` を使用して、テンプレート (`claude_desktop_config.template.json`または`cursor_config.template.json`) と `.env` ファイルから設定ファイル (`claude_desktop_config.json`または`config.json`) を自動生成し、Claude デスクトップアプリまたはCursor IDEの設定ディレクトリにインストールします。

**Claude Code向けには、個別MCPサーバーの管理機能も提供します。**

## 対応している機能

このリポジトリは以下の機能を Claude デスクトップアプリとCursor IDEで利用できるようにします：

- **Brave 検索**: Web 検索および地域検索
- **ファイルシステム**: ローカルファイルの操作
- **Git**: リポジトリ操作
- **GitHub**: リポジトリ管理
- **シェル**: コマンド実行
- **Puppeteer**: Web スクレイピング
- **Fetch**: HTTP リクエスト
- **Claude CLI**: コマンドライン連携
- **AWS Documentation**: AWS 関連情報の検索
- **Supabase**: データベース連携
- **Obsidian**: Obsidian ノートの操作

## 前提条件

- [Bun](https://bun.sh/)がインストールされていること
- システムに `make` がインストールされていること
- Claude デスクトップアプリ、Cursor IDE、または[Claude Code](https://claude.ai/code)がインストールされていること
- [uvx](https://uvy.io/)がインストールされていること（AWS Documentation 機能を使用する場合）
- **Claude Code用**: Claude CLIがインストールされていること

## セットアップ

1. **リポジトリをクローンします:**

   ```bash
   git clone git@github.com:drapon/claude-mcp-servers.git
   cd claude-ts-mcps
   ```

2. **.env ファイルを作成します:**

   以下のような内容の `.env` ファイルを作成し、必要な値を設定します。

   ```
   # API Keys and Tokens
   BRAVE_API_KEY=your_brave_api_key         # Brave検索のAPI Key
   GITHUB_TOKEN=your_github_personal_access_token  # GitHub個人アクセストークン
   SUPABASE_API_KEY=your_supabase_api_key   # SupabaseのAPI Key
   FIGMA_API_KEY=your_figma_api_key         # FigmaのAPI Key

   # Executables Paths
   BUN_PATH=/path/to/bun                    # bunコマンドのフルパス（通常は /opt/homebrew/bin/bun）
   UVX_PATH=/path/to/uvx                    # uvxコマンドのフルパス（通常は /usr/local/bin/uvx）
   NPX_PATH=/path/to/npx                    # npxコマンドのフルパス
   CLAUDE_CLI_PATH=/path/to/claude/cli      # Claude CLIのフルパス

   # Directories
   HOME_DIR=/your/home/directory            # ホームディレクトリのパス
   OBSIDIAN_VAULT_DIR=/path/to/obsidian/vault  # Obsidianのvaultディレクトリ
   CURSOR_WORKSPACE_PATH=/path/to/workspace    # Cursorのワークスペースパス (Cursor用)

   # Fetch Tool Configuration
   CUSTOM_USER_AGENT=Mozilla/5.0 (...)      # カスタムユーザーエージェント設定
   IGNORE_ROBOTS_TXT=false                  # robots.txtを無視するかどうか
   ```

3. **依存関係をインストールして設定します:**

   **Claude Desktop用の場合:**

   ```bash
   # MCPサーバーを選択的に有効化する（推奨）
   make select-mcps

   # または、従来の自動セットアップ
   make setup
   ```

   **Cursor IDE用の場合:**

   ```bash
   # Cursor用のMCPサーバーを設定
   ./scripts/setup_cursor_mcp.sh
   ```

   **Claude Code用の場合:**

   ```bash
   # 個別MCPサーバーをビルドして対話的に設定（推奨）
   make reset-and-setup-claude-code

   # または、リセットせずに追加設定
   make setup-claude-code

   # 既存の設定をリセットのみ
   make reset-claude-code

   # 設定済みMCPサーバーの確認
   make list-claude-code-mcps
   ```

   これにより、以下の処理が行われます:

   - ルートディレクトリと`ts`ディレクトリの依存関係がインストールされます
   - `select-mcps`を使用した場合:
     - 有効にするMCPサーバーを選択できます
     - 必要な環境変数を対話的に入力できます
   - テンプレートファイル（`claude_desktop_config.template.json`または`cursor_config.template.json`）と `.env` ファイルから設定ファイルが生成されます
   - 生成された設定ファイルが適切な設定ディレクトリにコピーされます

4. **アプリケーションを再起動します:**

   変更を反映させるために、Claude デスクトップアプリやCursor IDEを再起動してください。

## Makefile コマンド

### Claude Desktop / Cursor IDE 用

- `make all` または `make`: デフォルトターゲット。`setup` ターゲットを実行します
- `make setup`: 依存関係をインストールし、設定ファイルを生成して Claude デスクトップアプリの設定ディレクトリにコピーします
- `make select-mcps`: インタラクティブにMCPサーバーを選択して設定します。必要な環境変数の設定も行えます
- `make cursor-setup`: Cursor IDE用の設定ファイルをインストールします
- `make cursor-interactive`: Cursor IDE用のインタラクティブセットアップを実行します

### Claude Code 用

- `make build-individual-mcps`: 個別MCPサーバーを`dist/`ディレクトリにビルドします
- `make setup-claude-code`: Claude Code用MCPサーバーを対話的に設定します
- `make reset-and-setup-claude-code`: 既存の設定をリセットしてから新規設定します（推奨）
- `make reset-claude-code`: 既存のClaude Code MCP設定をリセットします
- `make list-claude-code-mcps`: 現在設定されているMCPサーバーを一覧表示します

### 共通

- `make install`: 依存関係のみをインストールします
- `make clean`: 生成された設定ファイルとビルドファイルを削除します

## 設定ファイル

- `claude_desktop_config.template.json`: Claude Desktop用の機能設定のテンプレートファイル
- `cursor_config.template.json`: Cursor IDE用の機能設定のテンプレートファイル
- `.env`: 環境変数を定義するファイル（リポジトリには含まれません）
- `claude_desktop_config.json`: Claude Desktop用の生成された設定ファイル（リポジトリには含まれません）
- `config.json`: Cursor IDE用の生成された設定ファイル（リポジトリには含まれません）

## カスタマイズ

`.env` ファイルとテンプレートファイルを変更することで、設定をカスタマイズできます:

- **.env**: 環境固有の値とシークレットをここで定義します
- **テンプレートファイル**: 機能設定のテンプレートを必要に応じて変更します
- **インタラクティブ選択**: `make select-mcps` を使用して、使用したいMCPサーバーのみを有効にできます

## Obsidian 機能の使用方法

Obsidian 機能を使用するには、`.env`ファイルに`OBSIDIAN_VAULT_DIR`を設定する必要があります。この機能は以下のツールを提供します：

1. **write_note**: Obsidian ノートを作成または更新します

   - `path`: ノートのパス（.md 拡張子はオプション）
   - `content`: ノートの内容
   - `append`: true の場合、既存のノートに追記します（オプション）

2. **delete_note**: Obsidian ノートを削除します

   - `path`: 削除するノートのパス

3. **read_notes**: 複数のノートを一度に読み取ります

   - `paths`: 読み取るノートのパスの配列

4. **search_notes**: ノート名で検索します
   - `query`: 検索クエリ（大文字小文字を区別しない）

例：

```
// ノートを作成する
write_note({"path": "Projects/新しいプロジェクト", "content": "# 新しいプロジェクト\n\nここにプロジェクトの詳細を記述します。"})

// ノートに追記する
write_note({"path": "Projects/新しいプロジェクト", "content": "## 追加情報\n\nここに追加情報を記述します。", "append": true})

// ノートを検索する
search_notes({"query": "プロジェクト"})

// ノートを読み取る
read_notes({"paths": ["Projects/新しいプロジェクト", "Daily/2025-04-12"]})

// ノートを削除する
delete_note({"path": "Projects/古いプロジェクト"})
```

## Claude Code での使用方法

Claude Code は**個別MCP管理**を採用しており、プロジェクトごとに必要なMCPサーバーのみを選択して使用できます。

### MCP スコープについて

Claude Code では3つのスコープがあります：

1. **local**（デフォルト）: 現在のプロジェクトでのみ利用可能
2. **project**: `.mcp.json`ファイルでチーム共有可能
3. **user**: 全プロジェクトで利用可能

### 基本的な使用フロー

```bash
# 1. 個別MCPサーバーをビルド
make build-individual-mcps

# 2. 既存設定をリセットして新規設定（推奨）
make reset-and-setup-claude-code

# 3. Claude Code内で動作確認
claude code
# Claude Code内で: /mcp
```

### Claude Code内での確認

Claude Code内で以下のコマンドを使用してMCPサーバーの状態を確認できます：

```
/mcp
```

これにより、接続されているMCPサーバーの一覧と状態が表示されます。

### プロジェクト共有での使用

チームで共有したい場合は、`project`スコープを使用します：

1. MCPセットアップ時に「project」スコープを選択
2. 生成された`.mcp.json`ファイルをGitにコミット
3. チームメンバーがプロジェクトをクローン後、Claude Codeが自動的にMCPサーバーを認識

### トラブルシューティング（Claude Code）

- **Claude CLIが見つからない**: Claude CLIが正しくインストールされているか確認
- **MCPサーバーが接続されない**: `make list-claude-code-mcps`で設定を確認
- **権限エラー**: Claude Codeの実行時にプロジェクトスコープのMCPを承認
- **設定のリセット**: `make reset-claude-code`で全設定をクリア

````

## MCP の開発と拡張

このリポジトリに新しい MCP を追加する方法：

1. **新しいサーバーファイルの作成**:
   `/ts/src/` ディレクトリに新しい `.ts` ファイルを作成します。既存のファイル（例：`obsidian.ts`）を参考にできます。

2. **必要なスキーマの定義**:
   Zod を使用して入力パラメータのスキーマを定義します。

   ```typescript
   const MyToolArgsSchema = z.object({
     param1: z.string().describe("パラメータ1の説明"),
     param2: z.number().optional().describe("オプションのパラメータ2"),
   });
````

3. **ツール実装の追加**:
   `server.setRequestHandler()` 内でツールの動作を実装します。

4. **設定ファイルへの追加**:
   テンプレートファイル（`claude_desktop_config.template.json`と`cursor_config.template.json`）に新しい MCP の設定を追加します。

   ```json
   "my-new-tool": {
     "command": "{{BUN_PATH}}",
     "args": ["run", "{{PROJECT_ROOT}}/ts/src/my-new-tool.ts", "{{SOME_PARAMETER}}"]
   }
   ```

5. **環境変数の追加**:
   必要に応じて `.env` ファイルに新しい環境変数を追加し、README を更新します。

## トラブルシューティング

- 問題が発生した場合は、コンソール出力を確認してエラーメッセージがないか確認してください
- `.env` ファイルのパスが正しいことを確認してください
- `bun` コマンドが機能していることを確認してください
- Obsidian 機能の場合、`OBSIDIAN_VAULT_DIR`が正しく設定されていることを確認してください
- インタラクティブセットアップ中に問題が発生した場合は、`make setup`を使用して従来の方法でセットアップしてみてください
- Cursor IDEの設定に問題がある場合は、Cursorの設定画面でMCPの設定パスが正しく指定されているか確認してください

## 開発方針

このプロジェクトはパッケージマネージャーとして[Bun](https://bun.sh/)のみを使用しています。npm や yarn などの他のパッケージマネージャーはサポートされていないため、すべてのインストールと実行には`bun`コマンドを使用してください。
