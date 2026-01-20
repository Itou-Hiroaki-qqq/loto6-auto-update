import { neon } from '@neondatabase/serverless'

// ビルド時にはエラーを出さず、実行時にチェックする
// RailwayやVercelでは、ビルド時に環境変数が設定されていない場合があるため
// ビルド時はダミーURLを使用（実際には使用されない）
// 実行時には環境変数が設定されている必要がある
const databaseUrl = process.env.DATABASE_URL || 'postgresql://dummy:dummy@dummy:5432/dummy'

const sql = neon(databaseUrl)

// 手動でクエリを実行するためのヘルパー
export { sql }
