/* Sorting table sources */
var orderByPrice = false, orderByChange = false, orderBy24h = false;
function listSort(kind) {
    var obj = { price: 'price', change: 'change', allday: '24h' };

    /* Price */
    if (kind == obj.price) {
        $(".markets table").html(
            orderByPrice ? $(".markets table tr").sort(function (a, b) {
                orderByPrice = true;
                return $(b).data(dataNm) - $(a).data(dataNm);
            }) : $(".markets table tr").sort(function (a, b) {
                orderByPrice = false;
                return $(a).data(dataNm) - $(b).data(dataNm);
            })
        );
    }

    /* Change */
    if (kind == obj.change) {
        $(".markets table").html(
            orderByPrice ? $(".markets table tr").sort(function (a, b) {
                orderByChange = true;
                return $(b).data(dataNm) - $(a).data(dataNm);
            }) : $(".markets table tr").sort(function (a, b) {
                orderByChange = false;
                return $(a).data(dataNm) - $(b).data(dataNm);
            })
        );
    }

    /* 24Hours */
    if (kind == obj.allday) {
        $(".markets table").html(
            orderByPrice ? $(".markets table tr").sort(function (a, b) {
                orderBy24h = true;
                return $(b).data(dataNm) - $(a).data(dataNm);
            }) : $(".markets table tr").sort(function (a, b) {
                orderBy24h = false;
                return $(a).data(dataNm) - $(b).data(dataNm);
            })
        );
    }
}

/* Stock Settings */
var code = "KRW-BTC", code_kr = "비트코인", once = false, candle, cdata = [], force = 0;
var funcs = {
    removeAllClass: (obj) => {
        if (obj.hasClass("up")) {
            obj.removeClass("down");
            obj.removeClass("keep");
        }
        else if (obj.hasClass("down")) {
            obj.removeClass("up");
            obj.removeClass("keep");
        }
        else if (obj.hasClass("keep")) {
            obj.removeClass("down");
            obj.removeClass("up");
        }
    },
    unixToISO: (time) => {
        return Date.parse(time) / 1000;
    },
    post: async (type, url, data) => {
        return new Promise((resolve, reject) => {
            $.ajax({
                type, url, data
            }).done(res => resolve(res));
        });
    },
    formatJSON: (d_time, d_open, d_high, d_low, d_close) => {
        return {
            time: funcs.unixToISO(d_time),
            open: parseFloat(d_open),
            high: parseFloat(d_high),
            low: parseFloat(d_low),
            close: parseFloat(d_close)
        };
    },
    update: (d_time, d_open, d_high, d_low, d_close) => {
        candle.update(funcs.formatJSON(d_time, d_open, d_high, d_low, d_close));
    },
    chart_init: () => {
        const chart_element = document.getElementById("chart");
        const chart_properties = {
            width: 700, height: 400,
            timeScale: { visible: true, timeVisible: true, secondsVisible: false },
        };
        const chart = LightweightCharts.createChart(chart_element, chart_properties);
        candle = chart.addCandlestickSeries();
        candle.applyOptions({
            wickUpColor: 'rgb(225, 50, 85)',
            upColor: 'rgb(225, 50, 85)',
            wickDownColor: 'rgb(54, 116, 217)',
            downColor: 'rgb(54, 116, 217)',
            borderVisible: false,
        });
    },
    chart_init_click: (var_code, var_code_kr, element, dd) => {
        code = var_code, code_kr = var_code_kr;
        if (dd) {
            $("tr").removeClass("focus");
            $(element).addClass("focus");
        }
        $("#coin").text(code_kr);
        funcs.post("POST", "/api/candles", { market: code }).then(res => {
            cdata = [];
            res.forEach((data, idx) => {
                if (idx == 0) force = data.candle_date_time_utc;
                cdata.push(funcs.formatJSON(data.candle_date_time_utc, data.opening_price, data.high_price, data.low_price, data.trade_price));
            });
            console.log(cdata);
            console.log("dd " + force)
            candle.setData(cdata);
        });
    },
    chart_interval: () => {
        $("#coin").text(code_kr);
        funcs.post("POST", "/api/candles", { market: code }).then(res => {
            var filter = res.slice(res.findIndex(x => x.time == cdata[cdata.length - 1].time), res.length);
            filter.forEach((data, idx) => {
                funcs.update(data.candle_date_time_utc, data.opening_price, data.high_price, data.low_price, data.trade_price);
            });
        });
    },
    chart_history: () => {
        funcs.post("POST", "/api/history", { market: code, history: force }).then(res => {
            var temp = [];
            res.forEach((data, idx) => {
                if (idx == 0) force = data.candle_date_time_utc;
                console.log(data.candle_date_time_utc);
                temp.push(funcs.formatJSON(data.candle_date_time_utc, data.opening_price, data.high_price, data.low_price, data.trade_price));
            });
            cdata = [...temp, ...cdata];
            candle.setData(cdata);
        });
    },
};

funcs.chart_init();
funcs.chart_init_click(code, code_kr, this, false);
setInterval(() => { funcs.chart_interval(code, code_kr) }, 1000);

/* Socket Settings */
var socket = io.connect("/");
socket.on('markets', function (data) {
    var market_code = data.code.split('-')[1];
    if (market_code == 'BTC') {
        var market_price_class = data.change == 'RISE' ? 'up' : data.change == 'EVEN' ? 'keep' : 'down';
        var market_price_num1 = data.change == 'RISE' ? '+' : data.change == 'EVEN' ? '' : '-';
        var market_price_num2 = data.change == 'RISE' ? '' : data.change == 'EVEN' ? '' : '-';
        var acc_trade_price_24h = String(Number(data.acc_trade_price_24h.toFixed(0)).toLocaleString()).replace(',' + String(Number(data.acc_trade_price_24h.toFixed(0)).toLocaleString()).slice(-7), '') + '백만';
        var target = $(`.${market_code}`);
        funcs.removeAllClass(target);
        target.addClass(market_price_class);
        $(`.${market_code}-price`).text(data.trade_price.toLocaleString());
        $(`.${market_code}-change-1`).text(`${market_price_num1}${(data.change_rate * 100).toFixed(2)}%`);
        $(`.${market_code}-change-2`).text(`${market_price_num2}${data.change_price.toLocaleString()}`);
        $(`.${market_code}-acc-trade-price-24h`).text(acc_trade_price_24h);
    }
});