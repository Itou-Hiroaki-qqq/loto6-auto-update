import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/neon'
import { scrapeWinningNumbersWithPuppeteer } from '@/lib/loto6/scraper'

/**
 * 自動更新用APIエンドポイント
 * cron.job.orgから呼び出される
 * APIキー認証が必要
 * 
 * Railway専用の軽量バックエンドプロジェクト
 * このプロジェクトは自動更新機能のみを提供します
 */
export async function GET(request: NextRequest) {
    try {
        // APIキー認証
        const apiKey = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('apiKey')
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
        
        // 最新の当選番号をスクレイピング
        // Railway環境ではPuppeteerを直接使用（動作しやすい）
        const url = 'https://www.mizuhobank.co.jp/takarakuji/check/loto/loto6/index.html'
        console.log('[Auto Update] Railway environment detected, using Puppeteer...')
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
                const insertResult = await sql`
                    INSERT INTO winning_numbers (draw_date, main_numbers, bonus_number, draw_number, created_at, updated_at)
                    VALUES (${result.drawDate}::date, ${numbersString}::integer[], ${result.bonusNumber}, ${result.drawNumber || null}, NOW(), NOW())
                    ON CONFLICT (draw_date) 
                    DO UPDATE SET
                        main_numbers = EXCLUDED.main_numbers,
                        bonus_number = EXCLUDED.bonus_number,
                        draw_number = EXCLUDED.draw_number,
                        updated_at = NOW()
                    RETURNING draw_date
                `
                
                if (Array.isArray(insertResult) && insertResult.length > 0) {
                    // 既存データかどうかを確認（updated_atがcreated_atと同じなら新規）
                    const existing = await sql`
                        SELECT created_at, updated_at 
                        FROM winning_numbers 
                        WHERE draw_date = ${result.drawDate}::date
                    `
                    
                    if (existing.length > 0) {
                        const createdAt = new Date(existing[0].created_at)
                        const updatedAt = new Date(existing[0].updated_at)
                        // 1秒以内の差なら新規データとみなす
                        if (Math.abs(updatedAt.getTime() - createdAt.getTime()) < 1000) {
                            savedCount++
                        } else {
                            skippedCount++
                        }
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
        
        return NextResponse.json({
            success: true,
            message,
            count: savedCount,
            updated: skippedCount,
            total: results.length,
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
