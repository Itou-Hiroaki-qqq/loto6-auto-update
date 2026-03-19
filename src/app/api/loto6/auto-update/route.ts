import { NextRequest, NextResponse } from 'next/server'
import { sql, assertDatabaseUrl } from '@/lib/neon'
import { scrapeWinningNumbersWithPuppeteer } from '@/lib/loto6/scraper'

/**
 * 自動更新用APIエンドポイント
 * cron.job.orgから呼び出される
 * APIキー認証が必要
 *
 * Cloud Run 向け軽量バックエンド（自動更新機能のみ提供）
 */
export async function GET(request: NextRequest) {
    try {
        // DB接続チェック（未設定なら即座にエラー）
        assertDatabaseUrl()

        // APIキー認証（x-api-key ヘッダーのみ受け付ける）
        const apiKey = request.headers.get('x-api-key')
        const expectedApiKey = process.env.AUTO_UPDATE_API_KEY
        
        if (!expectedApiKey) {
            console.error('[Auto Update] AUTO_UPDATE_API_KEY is not set in environment variables')
            return NextResponse.json(
                { error: 'API key not configured' },
                { status: 500 }
            )
        }
        
        if (apiKey !== expectedApiKey) {
            console.warn('[Auto Update] Invalid API key attempt')
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }
        
        console.log('[Auto Update] Starting automatic update...')
        
        // 最新の当選番号をスクレイピング（Puppeteer）
        const url = 'https://www.mizuhobank.co.jp/takarakuji/check/loto/loto6/index.html'
        console.log('[Auto Update] Starting scrape with Puppeteer...')
        const results = await scrapeWinningNumbersWithPuppeteer(url)
        
        if (results.length === 0) {
            console.warn('[Auto Update] No winning numbers found')
            return NextResponse.json({
                success: true,
                message: '当選番号が見つかりませんでした',
                count: 0,
            })
        }
        
        let savedCount = 0
        let skippedCount = 0
        
        for (const result of results) {
            const numbersString = `{${result.mainNumbers.join(',')}}`
            
            try {
                // PostgreSQLのUPSERT（既存データは更新、新規データは挿入）
                // xmax = 0 なら新規INSERT、それ以外はUPDATE
                const insertResult = await sql`
                    INSERT INTO winning_numbers (draw_date, main_numbers, bonus_number, draw_number, created_at, updated_at)
                    VALUES (${result.drawDate}::date, ${numbersString}::integer[], ${result.bonusNumber}, ${result.drawNumber || null}, NOW(), NOW())
                    ON CONFLICT (draw_date)
                    DO UPDATE SET
                        main_numbers = EXCLUDED.main_numbers,
                        bonus_number = EXCLUDED.bonus_number,
                        draw_number = EXCLUDED.draw_number,
                        updated_at = NOW()
                    RETURNING draw_date, (xmax = 0) AS is_inserted
                `

                if (Array.isArray(insertResult) && insertResult.length > 0) {
                    if (insertResult[0].is_inserted) {
                        savedCount++
                    } else {
                        skippedCount++
                    }
                }
            } catch (error) {
                console.error(`[Auto Update] Error saving ${result.drawDate}:`, error)
            }
        }
        
        const message = savedCount > 0
            ? `自動更新完了: 新規${savedCount}件、更新${skippedCount}件`
            : `自動更新完了: 更新${skippedCount}件（新規データなし）`

        console.log(`[Auto Update] ${message}`)

        // Cloudflare Workers版（D1）にもデータを送信
        let cloudflareSync = 'skipped'
        const cloudflareUrl = process.env.CLOUDFLARE_APP_URL
        const cloudflareApiKey = process.env.CLOUDFLARE_API_KEY
        if (cloudflareUrl && cloudflareApiKey) {
            try {
                console.log(`[Auto Update] Syncing to Cloudflare: ${cloudflareUrl}/api/loto6/import`)
                const syncResponse = await fetch(`${cloudflareUrl}/api/loto6/import`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': cloudflareApiKey,
                    },
                    body: JSON.stringify({ results }),
                })
                const syncData = await syncResponse.json()
                if (syncResponse.ok && syncData.success) {
                    cloudflareSync = `success: ${syncData.message}`
                    console.log(`[Auto Update] Cloudflare sync: ${syncData.message}`)
                } else {
                    cloudflareSync = `failed: ${syncData.error || syncResponse.status}`
                    console.error(`[Auto Update] Cloudflare sync failed:`, syncData)
                }
            } catch (error) {
                cloudflareSync = `error: ${error instanceof Error ? error.message : 'Unknown'}`
                console.error('[Auto Update] Cloudflare sync error:', error)
            }
        } else {
            console.log('[Auto Update] Cloudflare sync skipped (CLOUDFLARE_APP_URL or CLOUDFLARE_API_KEY not set)')
        }

        return NextResponse.json({
            success: true,
            message,
            count: savedCount,
            updated: skippedCount,
            total: results.length,
            cloudflareSync,
        })
        
    } catch (error) {
        console.error('[Auto Update] Error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({
            success: false,
            error: `エラーが発生しました: ${errorMessage}`,
        }, { status: 500 })
    }
}

// POSTメソッドもサポート（cron.job.orgの設定によってはPOSTを使用する場合がある）
export async function POST(request: NextRequest) {
    return GET(request)
}
