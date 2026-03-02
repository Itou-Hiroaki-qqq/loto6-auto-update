import { neon } from '@neondatabase/serverless'

// ビルド時には環境変数が未設定の場合があるため、ダミーURLでインスタンスを生成する。
// 実際のクエリ実行前に DATABASE_URL の存在チェックを行うこと。
const databaseUrl = process.env.DATABASE_URL || 'postgresql://dummy:dummy@dummy:5432/dummy'

export const sql = neon(databaseUrl)

/**
 * DATABASE_URL が設定されているか確認する。
 * APIルートのリクエスト処理の先頭で呼び出すことで、
 * 設定漏れを早期に検出できる。
 */
export function assertDatabaseUrl(): void {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is not set in environment variables')
    }
}
