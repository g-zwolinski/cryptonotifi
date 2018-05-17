exports.exchanges = ['binance']
exports.markets = []
exports.breakpoints = {
    o: 1,
    h: 1,
    l: 1,
    c: 1,
    v: 1
}
exports.interval = '1m'
exports.period = 60
exports.pauseTime = 1/6
exports.enableRateLimit = true
exports.warnOnFetchOHLCVLimitArgument = false
exports.enableProxy = false
exports.proxy = ''
exports.showErrors = true
exports.showLog = false
exports.mockupMessages = true
exports.newLineSymbol = ' | '
exports.startpass = /startpass/
exports.stoppass = /stoppass/

exports.MACD = {
	fastPeriod        : 5,
	slowPeriod        : 8,
	signalPeriod      : 3 ,
	SimpleMAOscillator: false,
	SimpleMASignal    : false
}

exports.OBV = {

}

exports.PSAR = {
	step: 0.02,
	max: 0.2
}

exports.RSI = {
	period : 14
}

exports.StochRSI = {
	kPeriod: 3,
	dPeriod: 3
}

exports.ROC = {
	period: 12
}