const ccxt = require ('ccxt')
    , log  = require ('ololog')
    , ansi = require ('ansicolor').nice
    , dateFormat = require('dateformat')
    , config = require('./config.js')
    , telegram = require('./telegram.js')
    , MACD = require('technicalindicators').MACD
    , SMA = require('technicalindicators').SMA
    , OBV = require('technicalindicators').OBV
    , PSAR = require('technicalindicators').PSAR
    , ROC = require('technicalindicators').ROC
    , RSI = require('technicalindicators').RSI

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

let StochRSI = function (timePeriod, kPeriod, dPeriod, rsi){
    let closes = [1, 2, 3, 4];
    let fastK = [], prev, min, max

    for(let i = timePeriod; i < rsi.length; i++){
        prev = rsi.slice((i + 1) - timePeriod, i + 1)
        min  = Math.min(...prev)
        max  = Math.max(...prev)

        fastK.push(((rsi[i] - min) / (max - min)) * 100);
    }

    let k = SMA.calculate({ values: fastK, period: kPeriod }),
        d = SMA.calculate({ values: k, period: dPeriod })

    return {
        k: k.slice(-1 * Math.min(k.length, d.length)),
        d: d.slice(-1 * Math.min(k.length, d.length))
    }
}

let percentageDifference = function(a,b){
    var percentage = a / b * 100
    return Math.round(percentage*10)/10
}

async function getIndicators(exchange, symbol){
    let limit = undefined
    let interval = config.interval

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

    let o = []
    let h = []
    let l = []
    let c = []
    let v = []

    for(var i = 0; i < ohlcv.length; i++){
        o.push(ohlcv[i][1])
        h.push(ohlcv[i][2])
        l.push(ohlcv[i][3])
        c.push(ohlcv[i][4])
        v.push(ohlcv[i][5])
    }

    /* MACD */
    let macdInput = {
      values            : c,
      fastPeriod        : config.MACD.fastPeriod,
      slowPeriod        : config.MACD.slowPeriod,
      signalPeriod      : config.MACD.signalPeriod,
      SimpleMAOscillator: config.MACD.SimpleMAOscillator,
      SimpleMASignal    : config.MACD.SimpleMASignal
    }
    let resultsMACD = MACD.calculate(macdInput)

    /* OBV */
    let obvInput = {
      close : c,
      volume : v
    }
    let resultsOBV = OBV.calculate(obvInput)

    /* PSAR */
    let psarInput = {
        high: h, 
        low: l, 
        step: config.PSAR.step, 
        max: config.PSAR.max
    }
    let resultsPSAR = PSAR.calculate(psarInput)

    /* RSI */
    let inputRSI = {
      values : c,
      period : config.RSI.period
    }
    let resultsRSI = RSI.calculate(inputRSI)

    /* StochRSI */
    let resultsStochRSI = StochRSI(config.RSI.period, config.StochRSI.kPeriod, config.StochRSI.dPeriod, resultsRSI)

    /* ROC */
    let inputROCbyRSI = {period : config.ROC.period, values : resultsRSI}
    let resultsROCbyRSI = ROC.calculate(inputROCbyRSI)
    // let inputROCbyStochRSI = {period : config.ROC.period, values : resultsStochRSI}
    // let resultsROCbyStochRSI = ROC.calculate(inputROCbyStochRSI)

    if(config.showLog) console.log(resultsMACD, resultsOBV, resultsPSAR, resultsRSI, resultsStochRSI, resultsROCbyRSI/*, resultsROCbyStochRSI*/)
}

async function main() {
    // console.log(RSI)
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
                        await getIndicators(exchange, market)
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
