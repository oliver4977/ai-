import { CandleData, ChartPattern, TechnicalIndicatorSignal, PatternType } from '../types';

/**
 * Calculates Simple Moving Average (SMA)
 */
export function calculateSMA(data: CandleData[], period: number): (number | undefined)[] {
  const result: (number | undefined)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(undefined);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close;
    }
    result.push(Number((sum / period).toFixed(2)));
  }
  return result;
}

/**
 * Calculates Exponential Moving Average (EMA)
 */
export function calculateEMA(data: CandleData[], period: number): (number | undefined)[] {
  const result: (number | undefined)[] = [];
  const k = 2 / (period + 1);
  let previousEMA: number | undefined;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(undefined);
      continue;
    }
    if (previousEMA === undefined) {
      // First EMA is simple average
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[j].close;
      }
      previousEMA = sum / period;
      result.push(Number(previousEMA.toFixed(2)));
    } else {
      const currentEMA = data[i].close * k + previousEMA * (1 - k);
      previousEMA = currentEMA;
      result.push(Number(currentEMA.toFixed(2)));
    }
  }
  return result;
}

/**
 * Calculates Relative Strength Index (RSI - 14)
 */
export function calculateRSI(data: CandleData[], period = 14): (number | undefined)[] {
  const result: (number | undefined)[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(undefined);
      continue;
    }
    const change = data[i].close - data[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);

    if (i < period) {
      result.push(undefined);
      continue;
    }

    if (i === period) {
      let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        result.push(Number(rsi.toFixed(2)));
      }
      continue;
    }

    // Smoothed RSI
    const prevRSIIndex = i - 1;
    let prevAvgGain = 0;
    let prevAvgLoss = 0;
    // calculate average over period
    let sumGain = 0;
    let sumLoss = 0;
    for (let k = i - period; k < i; k++) {
      sumGain += gains[k];
      sumLoss += losses[k];
    }
    prevAvgGain = sumGain / period;
    prevAvgLoss = sumLoss / period;

    const currentGain = gains[i - 1];
    const currentLoss = losses[i - 1];
    const smoothedGain = (prevAvgGain * (period - 1) + currentGain) / period;
    const smoothedLoss = (prevAvgLoss * (period - 1) + currentLoss) / period;

    if (smoothedLoss === 0) {
      result.push(100);
    } else {
      const rs = smoothedGain / smoothedLoss;
      const rsi = 100 - (100 / (1 + rs));
      result.push(Number(rsi.toFixed(2)));
    }
  }
  return result;
}

/**
 * Calculates MACD (12, 26, 9)
 */
export function calculateMACD(data: CandleData[]) {
  const ema12 = calculateEMA(data, 12);
  const ema26 = calculateEMA(data, 26);
  const macdLine: (number | undefined)[] = [];

  for (let i = 0; i < data.length; i++) {
    const e12 = ema12[i];
    const e26 = ema26[i];
    if (e12 !== undefined && e26 !== undefined) {
      macdLine.push(Number((e12 - e26).toFixed(2)));
    } else {
      macdLine.push(undefined);
    }
  }

  // Signal line is 9-period EMA of MACD line
  const validMacdStartIndex = macdLine.findIndex((v) => v !== undefined);
  const signalLine: (number | undefined)[] = new Array(data.length).fill(undefined);
  const histogram: (number | undefined)[] = new Array(data.length).fill(undefined);

  if (validMacdStartIndex !== -1) {
    const validMacd = macdLine.slice(validMacdStartIndex) as number[];
    const k = 2 / (9 + 1);
    let prevSignal: number | undefined;

    for (let i = 0; i < validMacd.length; i++) {
      const globalIndex = validMacdStartIndex + i;
      if (i < 8) {
        continue;
      }
      if (prevSignal === undefined) {
        let sum = 0;
        for (let j = 0; j < 9; j++) {
          sum += validMacd[j];
        }
        prevSignal = sum / 9;
        signalLine[globalIndex] = Number(prevSignal.toFixed(2));
      } else {
        const currentSignal = validMacd[i] * k + prevSignal * (1 - k);
        prevSignal = currentSignal;
        signalLine[globalIndex] = Number(currentSignal.toFixed(2));
      }

      if (macdLine[globalIndex] !== undefined && signalLine[globalIndex] !== undefined) {
        histogram[globalIndex] = Number((macdLine[globalIndex]! - signalLine[globalIndex]!).toFixed(2));
      }
    }
  }

  return { macdLine, signalLine, histogram };
}

/**
 * Calculates Bollinger Bands (20, 2)
 */
export function calculateBollingerBands(data: CandleData[], period = 20, multiplier = 2) {
  const sma = calculateSMA(data, period);
  const upper: (number | undefined)[] = [];
  const middle = sma;
  const lower: (number | undefined)[] = [];

  for (let i = 0; i < data.length; i++) {
    const m = middle[i];
    if (m === undefined || i < period - 1) {
      upper.push(undefined);
      lower.push(undefined);
      continue;
    }

    let varianceSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      varianceSum += Math.pow(data[j].close - m, 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);
    upper.push(Number((m + multiplier * stdDev).toFixed(2)));
    lower.push(Number((m - multiplier * stdDev).toFixed(2)));
  }

  return { upper, middle, lower };
}

/**
 * Enriches raw candle data with technical indicators
 */
export function enrichCandleData(candles: CandleData[]): CandleData[] {
  const sma20 = calculateSMA(candles, 20);
  const sma50 = calculateSMA(candles, 50);
  const sma120 = calculateSMA(candles, 120);
  const ema9 = calculateEMA(candles, 9);
  const ema21 = calculateEMA(candles, 21);
  const rsi = calculateRSI(candles, 14);
  const macd = calculateMACD(candles);
  const bb = calculateBollingerBands(candles, 20, 2);

  return candles.map((c, i) => ({
    ...c,
    sma20: sma20[i],
    sma50: sma50[i],
    sma120: sma120[i],
    ema9: ema9[i],
    ema21: ema21[i],
    rsi14: rsi[i],
    macd:
      macd.macdLine[i] !== undefined
        ? {
            macd: macd.macdLine[i]!,
            signal: macd.signalLine[i] ?? 0,
            histogram: macd.histogram[i] ?? 0,
          }
        : undefined,
    bollinger:
      bb.middle[i] !== undefined
        ? {
            upper: bb.upper[i]!,
            middle: bb.middle[i]!,
            lower: bb.lower[i]!,
          }
        : undefined,
  }));
}

/**
 * Detects Support and Resistance levels from pivot points
 */
export function findSupportResistanceLevels(candles: CandleData[], count = 3): { supports: number[]; resistances: number[] } {
  if (candles.length < 20) return { supports: [], resistances: [] };
  const currentPrice = candles[candles.length - 1].close;

  const swingHighs: number[] = [];
  const swingLows: number[] = [];

  for (let i = 2; i < candles.length - 2; i++) {
    const isHigh =
      candles[i].high > candles[i - 1].high &&
      candles[i].high > candles[i - 2].high &&
      candles[i].high > candles[i + 1].high &&
      candles[i].high > candles[i + 2].high;

    const isLow =
      candles[i].low < candles[i - 1].low &&
      candles[i].low < candles[i - 2].low &&
      candles[i].low < candles[i + 1].low &&
      candles[i].low < candles[i + 2].low;

    if (isHigh) swingHighs.push(candles[i].high);
    if (isLow) swingLows.push(candles[i].low);
  }

  // Filter resistances above current price and supports below current price
  const resistances = Array.from(new Set(swingHighs.filter((p) => p >= currentPrice * 0.99)))
    .sort((a, b) => a - b)
    .slice(0, count);

  const supports = Array.from(new Set(swingLows.filter((p) => p <= currentPrice * 1.01)))
    .sort((a, b) => b - a)
    .slice(0, count);

  return {
    supports: supports.length > 0 ? supports : [Number((currentPrice * 0.95).toFixed(2))],
    resistances: resistances.length > 0 ? resistances : [Number((currentPrice * 1.08).toFixed(2))],
  };
}

/**
 * Detects key chart patterns in the candle series
 */
export function detectChartPatterns(candles: CandleData[]): ChartPattern[] {
  if (candles.length < 30) return [];
  const patterns: ChartPattern[] = [];
  const len = candles.length;
  const latest = candles[len - 1];
  const prev = candles[len - 2];
  const prev2 = candles[len - 3];

  // 1. Golden Cross (SMA20 crosses above SMA50 or SMA50 above SMA120)
  if (latest.sma20 && latest.sma50 && prev.sma20 && prev.sma50) {
    if (latest.sma20 > latest.sma50 && prev.sma20 <= prev.sma50) {
      patterns.push({
        name: '골든 크로스 (Golden Cross)',
        type: 'BULLISH',
        description: '20일 이동평균선이 50일 이동평균선을 상향 돌파하여 강력한 중단기 상승 추세 전환 신호입니다.',
        confidence: 88,
      });
    } else if (latest.sma20 < latest.sma50 && prev.sma20 >= prev.sma50) {
      patterns.push({
        name: '데드 크로스 (Dead Cross)',
        type: 'BEARISH',
        description: '20일 이동평균선이 50일 이동평균선을 하향 이탈하여 단기 하락 압력이 증가하고 있습니다.',
        confidence: 82,
      });
    }
  }

  // 2. MACD Bullish Crossover
  if (latest.macd && prev.macd) {
    if (latest.macd.histogram > 0 && prev.macd.histogram <= 0) {
      patterns.push({
        name: 'MACD 상승 반전 크로스',
        type: 'BULLISH',
        description: 'MACD 라인이 시그널 라인을 상향 돌파하며 모멘텀이 매수 우위로 전환되었습니다.',
        confidence: 85,
      });
    }
  }

  // 3. RSI Oversold Rebound
  if (latest.rsi14 !== undefined && prev.rsi14 !== undefined) {
    if (latest.rsi14 >= 30 && prev.rsi14 < 30) {
      patterns.push({
        name: 'RSI 과매도 탈출 반등 (Oversold Bounce)',
        type: 'BULLISH',
        description: 'RSI가 30 이하 과매도 구간에서 반등에 성공하여 기술적 반등 가능성이 매우 높습니다.',
        confidence: 86,
      });
    } else if (latest.rsi14 > 70) {
      patterns.push({
        name: 'RSI 과열 주의 (Overbought Alert)',
        type: 'BEARISH',
        description: 'RSI 70 이상으로 단기 과열 구간에 진입하여 차익 실현 매물 출회에 유의해야 합니다.',
        confidence: 78,
      });
    }
  }

  // 4. Bollinger Band Bounce
  if (latest.bollinger && prev.bollinger) {
    if (prev.low <= prev.bollinger.lower && latest.close > latest.bollinger.lower) {
      patterns.push({
        name: '볼린저 밴드 하단 지지 반등',
        type: 'BULLISH',
        description: '볼린저 밴드 하단 밴드 터치 후 강력한 지지를 받고 중심선 회귀 반등이 시작되었습니다.',
        confidence: 84,
      });
    } else if (latest.close >= latest.bollinger.upper * 0.99) {
      patterns.push({
        name: '볼린저 밴드 상단 밴드 저항',
        type: 'NEUTRAL',
        description: '상단 밴드에 근접하여 밴드 돌파 시 추가 급등, 저항 시 밴드 내 횡보가 예상됩니다.',
        confidence: 72,
      });
    }
  }

  // 5. Candlestick Formations (Bullish Engulfing, Hammer)
  const isLatestBullish = latest.close > latest.open;
  const isPrevBearish = prev.close < prev.open;
  const latestBody = Math.abs(latest.close - latest.open);
  const latestLowerWick = Math.min(latest.open, latest.close) - latest.low;

  // Bullish Engulfing (상승 장악형)
  if (isLatestBullish && isPrevBearish && latest.close > prev.open && latest.open < prev.close) {
    patterns.push({
      name: '상승 장악형 캔들 (Bullish Engulfing)',
      type: 'BULLISH',
      description: '직전 음봉의 몸통통 전체를 감싸는 강력한 양봉이 출현하여 매수세 장악을 확인했습니다.',
      confidence: 83,
    });
  }

  // Hammer (망치형 바닥 반등)
  if (latestLowerWick > latestBody * 2 && latest.high - Math.max(latest.open, latest.close) < latestBody * 0.5) {
    patterns.push({
      name: '망치형 바닥 패턴 (Hammer)',
      type: 'BULLISH',
      description: '하단 긴 꼬리가 형성되며 저가 매수세가 강하게 유입되어 지지력을 입증했습니다.',
      confidence: 80,
    });
  }

  // Volume Breakout
  const avgVolume20 = candles.slice(-20).reduce((s, c) => s + c.volume, 0) / 20;
  if (latest.volume > avgVolume20 * 2.2 && isLatestBullish) {
    patterns.push({
      name: '대량 거래량 동반 양봉 돌파',
      type: 'BULLISH',
      description: `평균 거래량의 ${(latest.volume / avgVolume20).toFixed(1)}배가 유입되며 신규 매수 주체가 진입했습니다.`,
      confidence: 90,
    });
  }

  return patterns;
}

/**
 * Summarizes technical indicators into diagnostic items
 */
export function generateIndicatorSignals(candles: CandleData[]): TechnicalIndicatorSignal[] {
  if (candles.length === 0) return [];
  const latest = candles[candles.length - 1];
  const prev = candles.length > 1 ? candles[candles.length - 2] : latest;
  const signals: TechnicalIndicatorSignal[] = [];

  // 1. Moving Averages
  if (latest.sma20 && latest.sma50) {
    const isAboveSma20 = latest.close > latest.sma20;
    const isAligned = latest.sma20 > latest.sma50;
    signals.push({
      indicator: '이동평균선 배열',
      value: `SMA20: ${latest.sma20.toLocaleString()} / SMA50: ${latest.sma50.toLocaleString()}`,
      status: isAboveSma20 && isAligned ? 'BULLISH' : !isAboveSma20 && !isAligned ? 'BEARISH' : 'NEUTRAL',
      signal: isAboveSma20 && isAligned ? '정배열 상승 추세' : !isAboveSma20 && !isAligned ? '역배열 하락 압력' : '추세 전환 및 수렴 구간',
      detail: isAboveSma20 ? '현재 주가가 20일선 위에 위치하여 단기 상승 탄력 유지' : '20일선 하회로 단기 지지선 테스트 중',
    });
  }

  // 2. RSI (14)
  if (latest.rsi14 !== undefined) {
    const rsi = latest.rsi14;
    let status: PatternType = 'NEUTRAL';
    let signal = '중립 구간 (40~60)';
    let detail = '매수세와 매도세가 균형을 이루고 있습니다.';

    if (rsi >= 70) {
      status = 'BEARISH';
      signal = `과매열 구간 (${rsi.toFixed(1)})`;
      detail = '단기 과열로 차익 실현 매물 출회 가능성에 유의하세요.';
    } else if (rsi <= 35) {
      status = 'BULLISH';
      signal = `과매도 저평가 (${rsi.toFixed(1)})`;
      detail = '저가 반등 매수 유입 가능성이 매우 높은 국면입니다.';
    } else if (rsi > 50) {
      status = 'BULLISH';
      signal = `상승 모멘텀 (${rsi.toFixed(1)})`;
      detail = '기준선 50 상회로 매수 심리가 우세합니다.';
    }

    signals.push({
      indicator: 'RSI (상대강도지수 14)',
      value: `${rsi.toFixed(1)} pt`,
      status,
      signal,
      detail,
    });
  }

  // 3. MACD
  if (latest.macd) {
    const isHistPositive = latest.macd.histogram > 0;
    const isExpanding = prev.macd ? latest.macd.histogram > prev.macd.histogram : true;
    signals.push({
      indicator: 'MACD (12, 26, 9)',
      value: `MACD: ${latest.macd.macd.toFixed(2)} / Sig: ${latest.macd.signal.toFixed(2)}`,
      status: isHistPositive ? 'BULLISH' : 'BEARISH',
      signal: isHistPositive ? (isExpanding ? '상승 모멘텀 확장' : '상승세 둔화 조짐') : '하락 모멘텀 지속',
      detail: isHistPositive ? '시그널선 상회로 중기 매수 에너지 유효' : '시그널선 하회로 조정 압력 잔존',
    });
  }

  // 4. Bollinger Bands
  if (latest.bollinger) {
    const { upper, middle, lower } = latest.bollinger;
    const bandwidth = ((upper - lower) / middle) * 100;
    let status: PatternType = 'NEUTRAL';
    let signal = '밴드 정상 변동성';
    let detail = `밴드폭 ${bandwidth.toFixed(1)}%로 안정적 주가 흐름입니다.`;

    if (bandwidth < 8) {
      signal = '밴드 스퀴즈 (수렴 후 폭발 임박)';
      detail = '변동성이 극도로 축소되어 조만간 큰 방향성 분출이 예상됩니다.';
    } else if (latest.close > upper * 0.98) {
      status = 'BULLISH';
      signal = '상단 밴드 밴드라이딩';
      detail = '강력한 추세 확장이 지속되는 구간입니다.';
    } else if (latest.close < lower * 1.02) {
      status = 'BULLISH';
      signal = '하단 밴드 과매도 지지';
      detail = '하단 밴드 지지 반등 노림수가 유효합니다.';
    }

    signals.push({
      indicator: '볼린저 밴드 (20, 2)',
      value: `상단: ${upper.toLocaleString()} / 하단: ${lower.toLocaleString()}`,
      status,
      signal,
      detail,
    });
  }

  return signals;
}

export function formatKRW(val: number): string {
  return new Intl.NumberFormat('ko-KR').format(Math.round(val));
}

