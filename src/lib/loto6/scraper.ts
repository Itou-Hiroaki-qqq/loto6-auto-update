import * as cheerio from 'cheerio'
import puppeteerCore from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

// ローカル: 通常のpuppeteer / Railway: puppeteer-core + @sparticuz/chromium / Cloud Run: puppeteer-core + システム Chromium
let puppeteerInstance: typeof puppeteerCore
async function getPuppeteer() {
    if (!puppeteerInstance) {
        const isRailway = process.env.RAILWAY_ENVIRONMENT !== undefined || process.env.RAILWAY_ENVIRONMENT_NAME !== undefined
        const isCloudRun = process.env.K_SERVICE !== undefined

        if (isCloudRun || isRailway) {
            puppeteerInstance = puppeteerCore
        } else {
            // ローカル環境では通常のpuppeteerを使用（動的インポート）
            try {
                const puppeteerLocal = await import('puppeteer')
                puppeteerInstance = puppeteerLocal.default || puppeteerLocal as any
            } catch (e) {
                // puppeteerが見つからない場合はpuppeteer-coreを使用
                console.warn('[Scraper] puppeteer not found, falling back to puppeteer-core')
                puppeteerInstance = puppeteerCore
            }
        }
    }
    return puppeteerInstance
}

export interface ScrapedWinningNumbers {
    drawDate: string // YYYY-MM-DD
    mainNumbers: number[]
    bonusNumber: number
    drawNumber?: number
}

/**
 * テーブルから当選番号データを抽出（テストアプリの成功パターンを適用）
 * @param $ Cheerioインスタンス
 * @param $table テーブルのjQuery-likeオブジェクト
 * @param tableIndex テーブルのインデックス（デバッグ用）
 * @returns 抽出された当選番号データの配列
 */
function extractDataFromTable($: any, $table: any, tableIndex: number): ScrapedWinningNumbers[] {
    const results: ScrapedWinningNumbers[] = []
    
    try {
        // 抽選日を取得（テストアプリの成功パターン）
        const dateText = $table.find('.js-lottery-date-pc').first().text().trim()
        
        let drawDate = ''
        if (dateText) {
            // 2026年1月5日 -> 2026-01-05
            const match = dateText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
            if (match) {
                const [, year, month, day] = match
                drawDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
            }
        }
        
        // 回号を取得（テストアプリの成功パターン）
        const issueText = $table.find('.js-lottery-issue-pc').first().text().trim()
        let drawNumber: number | undefined
        if (issueText) {
            const drawMatch = issueText.match(/第(\d+)回/)
            if (drawMatch) {
                drawNumber = parseInt(drawMatch[1], 10)
            }
        }
        
        // 本数字を取得（テストアプリの成功パターン）
        const numbers: number[] = []
        $table.find('.js-lottery-number-pc').each((_: number, elem: cheerio.Element) => {
            const numText = $(elem).text().trim()
            const num = parseInt(numText, 10)
            if (!isNaN(num) && num >= 1 && num <= 43) {
                numbers.push(num)
            }
        })
        
        // ボーナス数字を取得（テストアプリの成功パターン）
        const bonusText = $table.find('.js-lottery-bonus-pc').first().text().trim()
        // ボーナス数字は "(04)" のような形式なので、括弧を除去して数値に変換
        const bonusMatch = bonusText.match(/\((\d+)\)/)
        const bonusNumber = bonusMatch ? parseInt(bonusMatch[1], 10) : parseInt(bonusText.replace(/[()]/g, ''), 10)
        
        // データの検証
        if (!dateText || numbers.length !== 6 || isNaN(bonusNumber)) {
            console.warn(`[Puppeteer Scraper] Table ${tableIndex}: Invalid data - date: "${dateText}", numbers: ${numbers.length}, bonus: ${bonusNumber}`)
            return results
        }
        
        if (!drawDate) {
            drawDate = new Date().toISOString().split('T')[0]
            console.warn(`[Puppeteer Scraper] Table ${tableIndex}: date not found, using current date`)
        }
        
        results.push({
            drawDate,
            mainNumbers: numbers.sort((a, b) => a - b),
            bonusNumber,
            drawNumber,
        })
        
        console.log(`[Puppeteer Scraper] ✓ Table ${tableIndex}: ${drawDate} (回号: ${drawNumber || 'N/A'}), 本数字: [${numbers.join(',')}], ボーナス: ${bonusNumber}`)
        
    } catch (error) {
        console.error(`[Puppeteer Scraper] Error processing table ${tableIndex}:`, error)
    }
    
    return results
}

/**
 * Puppeteerを使用してロト6の公式サイトから当選番号をスクレイピング
 * 動的に生成されるコンテンツに対応
 * テストアプリの成功パターンを適用
 * @param url スクレイピングするURL
 * @returns 当選番号の配列
 */
export async function scrapeWinningNumbersWithPuppeteer(url: string): Promise<ScrapedWinningNumbers[]> {
    let browser: any = null
    
    try {
        console.log(`[Puppeteer Scraper] Fetching URL: ${url}`)
        
        // 環境判定
        const isRailway = process.env.RAILWAY_ENVIRONMENT !== undefined || process.env.RAILWAY_ENVIRONMENT_NAME !== undefined
        const isCloudRun = process.env.K_SERVICE !== undefined

        console.log(`[Puppeteer Scraper] Environment: ${isCloudRun ? 'Cloud Run' : isRailway ? 'Railway' : 'Local'}`)

        // ブラウザの起動設定
        let executablePath: string | undefined = undefined

        // Cloud Run: コンテナ内のシステム Chromium を使用
        if (isCloudRun) {
            executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium'
            console.log(`[Puppeteer Scraper] Using system Chromium: ${executablePath}`)
        }
        // Railway環境: @sparticuz/chromium または環境変数
        else if (isRailway) {
            try {
                const remoteExecPath = process.env.CHROMIUM_REMOTE_EXEC_PATH
                if (remoteExecPath) {
                    console.log(`[Puppeteer Scraper] Using remote Chromium from: ${remoteExecPath}`)
                    executablePath = await chromium.executablePath(remoteExecPath)
                } else {
                    executablePath = await chromium.executablePath()
                }
                if (!executablePath) throw new Error('Chromium executable path is empty')
                console.log(`[Puppeteer Scraper] Chromium executable path: ${executablePath}`)
            } catch (error) {
                console.error(`[Puppeteer Scraper] Error getting executable path:`, error)
                executablePath = process.env.CHROMIUM_EXECUTABLE_PATH
                if (!executablePath) {
                    throw new Error(`Chromium executable path could not be determined. Set CHROMIUM_REMOTE_EXEC_PATH or CHROMIUM_EXECUTABLE_PATH.`)
                }
            }
        }

        const isContainer = isCloudRun || isRailway
        const launchOptions: any = {
            args: isContainer ? [
                ...(isCloudRun ? [] : chromium.args),
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                '--no-sandbox',
                '--single-process',
                '--no-zygote',
                '--disable-software-rasterizer',
            ] : [],
            defaultViewport: { width: 1920, height: 1080 },
            executablePath: executablePath,
            headless: true,
            ignoreHTTPSErrors: true,
        }
        
        console.log(`[Puppeteer Scraper] Launching browser with options:`, {
            ...launchOptions,
            executablePath: executablePath ? 'set' : 'undefined',
            argsCount: launchOptions.args.length,
        })
        
        // 環境に応じて適切なpuppeteerインスタンスを取得
        const puppeteer = await getPuppeteer()
        browser = await puppeteer.launch(launchOptions)
        const page = await browser.newPage()
        
        // User-Agentを設定
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        // ページにアクセス（テストアプリの成功パターン）
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000,
        })
        
        // JavaScript実行を待つ（テストアプリの成功パターン）
        try {
            await page.waitForSelector('.js-lottery-issue-pc, table, [class*="loto"]', { timeout: 10000 })
        } catch (e) {
            // セレクタが見つからない場合は5秒待機（テストアプリの成功パターン）
            console.log('[Puppeteer Scraper] Selector not found, waiting 5 seconds...')
            await page.waitForTimeout(5000)
        }
        
        // HTMLコンテンツを取得
        const html = await page.content()
        console.log(`[Puppeteer Scraper] HTML length: ${html.length} characters`)
        
        // CheerioでHTMLをパース（テストアプリの成功パターンを適用）
        const $ = cheerio.load(html)
        const results: ScrapedWinningNumbers[] = []
        
        // テストアプリの成功パターン：.js-lottery-issue-pcから.closest('table')で最初のテーブルを取得
        const issueElement = $('.js-lottery-issue-pc').first()
        
        if (issueElement.length === 0) {
            console.warn('[Puppeteer Scraper] .js-lottery-issue-pc not found, trying fallback method...')
            // フォールバック：テーブルを直接探す
            const tables = $('table')
            console.log(`[Puppeteer Scraper] Found ${tables.length} table(s) using fallback`)
            if (tables.length === 0) {
                console.error('[Puppeteer Scraper] No tables found')
                return results
            }
            // 最初のテーブルを処理
            const firstTable = $(tables[0])
            return extractDataFromTable($, firstTable, 0)
        }
        
        // 回別を取得
        const issueText = issueElement.text().trim()
        console.log(`[Puppeteer Scraper] Issue text: ${issueText}`)
        
        // 回別を含むテーブルを取得（テストアプリの成功パターン）
        const firstTable = issueElement.closest('table')
        
        if (firstTable.length === 0) {
            console.error('[Puppeteer Scraper] Table not found for .js-lottery-issue-pc')
            return results
        }
        
        console.log(`[Puppeteer Scraper] Found table using .closest('table') method`)
        
        // テーブルからデータを抽出（テストアプリの成功パターン）
        const extracted = extractDataFromTable($, firstTable, 0)
        if (extracted.length > 0) {
            results.push(...extracted)
        }
        
        console.log(`[Puppeteer Scraper] Total results found: ${results.length} for ${url}`)
        return results
        
    } catch (error) {
        console.error(`[Puppeteer Scraper] Error scraping ${url}:`, error)
        throw error
    } finally {
        // ブラウザを確実に閉じる
        if (browser) {
            await browser.close()
        }
    }
}
