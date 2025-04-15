# shadcn/ui MCP

このディレクトリには、shadcn/uiをMCP（Model Context Protocol）化するためのサンプル設定ファイルが含まれています。

## ファイル構成

- `components.json` - shadcn/uiの基本設定ファイル
- `tailwind.config.js` - Tailwindの設定ファイル

## 使用方法

### 1. セットアップ

あなたのプロジェクトで`shadcn/ui` MCPを利用するには：

1. このディレクトリの`components.json`と`tailwind.config.js`をあなたのプロジェクトのルートディレクトリにコピーします。
2. プロジェクトに応じて、これらのファイルを必要に応じて編集します。
3. MCPサーバーが起動した際に、これらの設定ファイルが自動的に検出されます。

### 2. MCP設定

`claude_desktop_config.json`に以下の設定を追加してください：

```json
"shadcn-ui": {
  "command": "{{BUN_PATH}}",
  "args": ["run", "{{PROJECT_ROOT}}/ts/src/shadcn-ui.ts"],
  "env": {}
}
```

必要に応じて環境変数で特定の設定ファイルを指定することも可能です：

```json
"shadcn-ui": {
  "command": "{{BUN_PATH}}",
  "args": ["run", "{{PROJECT_ROOT}}/ts/src/shadcn-ui.ts"],
  "env": {
    "SHADCN_CONFIG_PATH": "/specific/path/to/components.json"
  }
}
```

### 3. 利用可能なツール

shadcn/ui MCPは以下のツールを提供します：

1. `list_shadcn_components` - 利用可能なコンポーネントの一覧を取得
   ```
   {
     "projectPath": "/optional/path/to/project" // オプショナル
   }
   ```

2. `get_shadcn_component_info` - 特定のコンポーネントの詳細情報を取得
   ```
   {
     "name": "Button", // 必須
     "projectPath": "/optional/path/to/project", // オプショナル
     "depth": 3 // オプショナル、型情報の展開深さ
   }
   ```

3. `get_shadcn_design_tokens` - デザイントークン情報を取得
   ```
   {
     "category": "colors", // "colors", "space", "typography", "radii", "shadows", "all"のいずれか
     "projectPath": "/optional/path/to/project" // オプショナル
   }
   ```

### 4. 使用例

```typescript
// すべてのコンポーネントリストを取得
const componentList = await claude.callTool('list_shadcn_components', {});

// Buttonコンポーネントの詳細情報を取得
const buttonInfo = await claude.callTool('get_shadcn_component_info', {
  name: 'Button'
});

// カラーパレットを取得
const colorTokens = await claude.callTool('get_shadcn_design_tokens', {
  category: 'colors'
});

// 別プロジェクトのコンポーネント情報を取得
const cardInfo = await claude.callTool('get_shadcn_component_info', {
  name: 'Card',
  projectPath: '/path/to/other/project'
});
```

## 設定ファイルの自動検出

MCPサーバーは以下の順序で`components.json`ファイルを検索します：

1. ツール呼び出し時に明示的に指定された`projectPath`
2. 環境変数`SHADCN_CONFIG_PATH`で指定されたパス
3. カレントディレクトリおよびその親ディレクトリを順に検索

## 注意事項

- このMCPは現在開発中であり、すべての機能が完全に実装されているわけではありません。
- コンポーネントの型情報は実際のTypeScriptファイルを解析して生成されるべきですが、現在のサンプル実装では予め定義されたデータを使用しています。
- 実際の完全実装では、`ts-morph`などを使用してTypeScriptの型情報を解析することが推奨されます。
