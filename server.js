const express = require('express');
const app = express();
const session = require('express-session');
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const axios = require('axios');
const websocket = require('ws');
const passport = require('passport'), LocalStrategy = require('passport-local').Strategy;

var cache = [[], []];
const important = {
    port: 8080,
    limit: 50,
};
const upbitWebsocketAddr = 'wss://api.upbit.com/websocket/v1';
const upbitMarketsAddr = 'https://api.upbit.com/v1/market/all?isDetails=false';
const upbitTickerAddr = 'https://api.upbit.com/v1/ticker?markets=';
const upbitCandlesAddr = 'https://api.upbit.com/v1/candles/minutes/';
const converter = {
    str: (text) => {
        return String(text);
    },
    num: (text) => {
        return Number(text);
    },
    thous: (text) => {
        return Number(text).toLocaleString();
    },
    plainStr: (text) => {
        return ('' + +text).replace(/(-?)(\d*)\.?(\d*)e([+-]\d+)/, function (a, b, c, d, e) {
            return e < 0 ? b + '0.' + Array(1 - e - c.length).join(0) + c + d : b + c + d + Array(e - d.length + 1).join(0);
        });
    },
};
const headers = { accept: 'application/json' };
const upbit = {
    getMarkets: async () => {
        return await axios(upbitMarketsAddr, headers).then(res => res.data);
    },
    getTicker: async (marketsArr, multiple) => {
        if (multiple) marketsArr = marketsArr.join(',');
        return await axios.get(upbitTickerAddr + marketsArr, headers).then(res => res.data);
    },
    getCandles: async (market) => {
        if (market.length <= 0) return undefined;
        var uri = `${upbitCandlesAddr}1?market=${market}&count=200`;
        return await axios.get(uri, headers).then(res => res.data.reverse());
    },
    getHistory: async (market, history) => {
        console.log(history)
        if (market.length <= 0) return undefined;
        var uri = `${upbitCandlesAddr}1?market=${market}&to=${history}&count=200`;
        return await axios.get(uri, headers).then(res => res.data.reverse());
    },
    wsStartTicker: async () => {
        const markets = await upbit.getMarkets();
        const temp = [[], []];
        var market, marketKr;
        for (var i = 0; i < markets.length; i++) {
            market = markets[i].market;
            marketKr = markets[i].korean_name;
            if (converter.str(market).includes('KRW')) {
                temp[0].push(market);
                temp[1].push(marketKr);
            }
        }
        console.log(temp[0]);
        ws.send(`[{"ticket":"test"},{"type":"ticker","codes":[${temp[0].join()}]}]`);
        return temp;
    },
    dataToObj: async (marketsData, filter, single, markets) => {
        var temp, temp2, market, marketKorean, price, change, change_price, change_rate, high_price, low_price, acc_trade_price_24h;

        if (single) {

            temp = await upbit.getTicker(marketsData)[0];                                         // 현재 시세가 목록 가져오기
            market = temp.market;                                                           // 영어명
            marketKorean = markets[1][markets[0].findIndex(x => x == marketsData)];         // 한글명 검색 후 저장
            price = converter.num(converter.plainStr(temp.trade_price));                     // 시세가 10e+4 -> 100000.. 변경
            change = temp.change == 'EVEN' ? '-' : temp.change == 'RISE' ? '▲' : '▼';       // 주가 변동 정보
            change_price = temp.change_price;                                               // 주가 변동가
            change_rate = converter.num(temp.change_rate * 100).toFixed(2);                           // 주가 변동률
            high_price = temp.high_price;                                                   // 고가
            low_price = temp.low_price;                                                     // 저가
            acc_trade_price_24h = temp.acc_trade_price_24h;                                 // 24시간 거래량

            tmp = {
                market, marketKorean,
                price,
                change, change_price, change_rate,
                high_price, low_price,
                acc_trade_price_24h,
            };

        }
        else {

            marketsData = marketsData.join(',');
            temp = await upbit.getTicker(marketsData);
            temp2 = [];
            for (var i = 0; i < temp.length; i++) {
                console.log(temp[i]);
                market = temp[i].market;
                marketKorean = markets[1][markets[0].findIndex(x => x == market)];
                price = converter.num(converter.plainStr(temp[i].trade_price));
                change = temp[i].change == 'EVEN' ? '-' : temp[i].change == 'RISE' ? '▲' : '▼';
                change_price = temp[i].change_price;
                change_rate = converter.num(temp[i].change_rate * 100).toFixed(2);
                high_price = temp[i].high_price;
                low_price = temp[i].low_price;
                acc_trade_price_24h = temp[i].acc_trade_price_24h;

                temp2.push({
                    market, marketKorean,
                    price,
                    change, change_price, change_rate,
                    high_price, low_price,
                    acc_trade_price_24h,
                });
            }

        }

        if (filter != null) {
            if (filter == 'price') temp2.sort((a, b) => { return b.price - a.price });
            if (filter == 'change') temp2.sort((a, b) => { return b.change_price - a.change_price });
            if (filter == 'rate') temp2.sort((a, b) => { return b.change_rate - a.change_rate });
        }

        if (single) return temp;
        else return temp2;
    }
};

function unixToDate(date) {
    var time = new Date(date * 1000).toISOString();
    return time;
}

app.use(express.static('Public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'secret', resave: false, saveUninitialized: false }));
app.set('view engine', 'ejs');
app.set('views', __dirname + '/Pages');

const ws = new websocket(upbitWebsocketAddr);
ws.on('open', async () => {
    cache = await upbit.wsStartTicker();
    console.log('upbit ws connected');
});
ws.on('message', (data) => {
    try {
        io.emit('markets', JSON.parse(data.toString('utf-8')));
    }
    catch (err) { console.log(err); }
});

app.post('/api/market', async (req, res) => {
    var data = await upbit.getTicker(req.body.code);
    return res.json(data);
});

app.post('/api/candles', async (req, res) => {
    var data = (await upbit.getCandles(req.body.market));
    return res.json(data);
});

app.post('/api/history', async (req, res) => {
    //var tm = unixToDate(converter.num(req.body.history));
    var data = (await upbit.getHistory(req.body.market, req.body.history));
    return res.json(data);
});

app.get('/', async (req, res) => {
    var data = await upbit.dataToObj(cache[0], null, false, cache);
    return res.render('index.ejs', { data });
});

http.listen(important.port, () => console.log(`server on ${important.port}`));