const ccxt = require ('ccxt')
    , log  = require ('ololog')
    , ansi = require ('ansicolor').nice
    , dateFormat = require('dateformat')
    , config = require('./config.js')
    , telegram = require('./telegram.js')

checkErr = function(err, exchangeId, market){
    if(market === undefined) market = ''
    if(!config.showErrors) return
    if (err instanceof ccxt.DDoSProtection) {
        log.bright.red(exchangeId, market, '[DDoS Protection]')
    } else if (err instanceof ccxt.RequestTimeout) {
        log.bright.red(exchangeId, market, '[Request Timeout]')
    } else if (err instanceof ccxt.AuthenticationError) {
        log.bright.red(exchangeId, market, '[Authentication Error]')
    } else if (err instanceof ccxt.ExchangeNotAvailable) {
        log.bright.red(exchangeId, market, '[Exchange Not Available]')
    } else if (err instanceof ccxt.ExchangeError) {
        log.bright.red(exchangeId, market, '[Exchange Error]')
    } else if (err instanceof ccxt.NetworkError) {
        log.bright.red(exchangeId, market, '[Network Error]')
    } else if (err instanceof ccxt.InvalidNonce) {
        log.bright.red(exchangeId, market, '[InvalidNonce Error]')
    } else if (err instanceof ccxt.NotSupported) {
        log.bright.red(exchangeId, market, '[NotSupported Error]')
    } else if (err instanceof ccxt.InsufficientFunds) {
        log.bright.red(exchangeId, market, '[InsufficientFunds Error]')
    } else if (err instanceof ccxt.InvalidOrder) {
        log.bright.red(exchangeId, market, '[InvalidOrder Error]')
    } else if (err instanceof ccxt.OrderNotFound) {
        log.bright.red(exchangeId, market, '[OrderNotFound Error]')
    } else {
        throw err
    }
}
let percentageDifference = function(a,b){
    var percentage = a / b * 100
    return Math.round(percentage*10)/10
}

async function getOHLCV(exchange, symbol){
    let limit = undefined
    let interval = '1m'

    // enable either of the following two lines
    if(!config.warnOnFetchOHLCVLimitArgument) exchange.options['warnOnFetchOHLCVLimitArgument'] = false
    if(config.warnOnFetchOHLCVLimitArgument)  limit = 3

    let now = new Date()
    now.setMinutes(now.getMinutes() - config.period)
    let date = dateFormat(now, "isoUtcDateTime")
    since = exchange.parse8601 (date)
    let ohlcv = await exchange.fetchOHLCV (symbol, interval, since, limit)
    let fetchingFrom = date.green
    let firstCandleDate = ohlcv.length ? exchange.iso8601 (ohlcv[0][0]).yellow : undefined
    let lastCandleDate = ohlcv.length ? exchange.iso8601 (ohlcv[ohlcv.length - 1][0]).yellow : undefined
    let count = ohlcv.length.toString ().red
    results =  { fetchingFrom, firstCandleDate, lastCandleDate, count, ohlcv }

    let maxIndex = ohlcv.length-1
    if(config.showLog) log ('from', dateFormat(ohlcv[0][0], 'HH:MM'), 'to', dateFormat(ohlcv[maxIndex][0], 'HH:MM'))

    let indexes = ['o', 'h', 'l', 'c', 'v']
    let sendNotification = false
    let message = exchange.name+' '+symbol+config.newLineSymbol
    message = message + '(' + dateFormat(ohlcv[0][0], 'HH:MM') + ' - ' + dateFormat(ohlcv[maxIndex][0], 'HH:MM')+')'+config.newLineSymbol
    for(let i = 0; i < 5; i++){
        let dif = Number(100 - percentageDifference(ohlcv[0][i+1], ohlcv[maxIndex][i+1])).toFixed(2)
        if(Math.abs(dif) > config.breakpoints[indexes[i]]){
            sendNotification = true
            if(dif > 0){
                if(config.showLog) log.green(indexes[i], dif)
            }else{
                if(config.showLog) log.red(indexes[i], dif)
            }
        }else{
            if(config.showLog) log.blue(indexes[i], dif)
        }
        message = message+indexes[i]+' '+dif+config.newLineSymbol
    }
    if(sendNotification){
        await telegram.sendMessage(message)
    }
}

async function main() {

    let exchanges = []
    let succeeded = 0
    let failed = 0
    let total = 0

    for (let id in ccxt.exchanges) {
        let sid = ccxt.exchanges[id]
        if (config.exchanges.includes(sid) || config.exchanges.length === 0) {

            let exchange = new(ccxt)[sid]({ 
                enableRateLimit: config.enableRateLimit,
                proxy: config.enableProxy ? config.proxy : ''
            })

            try {
                await exchange.loadMarkets()
                for (let market in exchange.markets) {
                    if(config.showLog) console.log(market)
                    if(config.markets.includes(toString(market)) || config.markets.length === 0){
                        await getOHLCV(exchange, market)
                    }
                }
            } catch (err) {
                await checkErr(err, exchange.id)
            }
        }
    }
    setTimeout(main, 1000 * 60 * config.pauseTime)
}

main()
