export interface HourlyChartPoint {
  index: number;
  time: string;
  timeLabel: string;
  temperature: number;
  apparentTemp?: number;
  pop: number;
  weatherCode: number;
  isDay: boolean;
  isSelected?: boolean;
}

export interface TemperatureStats {
  minTemp: number;
  maxTemp: number;
  range: number;
  avgTemp: number;
  trend: 'warming' | 'cooling' | 'steady';
  netChange: number;
  peakLabel: string;
  troughLabel: string;
}

export function convertTemperature(celsius: number, unit: 'C' | 'F'): number {
  return unit === 'F' ? (celsius * 9) / 5 + 32 : celsius;
}

export function formatHourlyTimeLabel(
  isoString: string,
  indexInSlice: number,
  format: '12h' | '24h' = '12h'
): string {
  if (indexInSlice === 0) return 'Now';
  const timePart = isoString.split('T')[1]?.slice(0, 5);
  if (!timePart) return isoString;

  const [hours, minutes] = timePart.split(':').map(Number);
  if (format === '24h') {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour = hours % 12 || 12;
  return `${hour} ${suffix}`;
}

export function buildHourlyChartData({
  times,
  temperatures,
  apparentTemps,
  precipProbabilities,
  weatherCodes,
  hourlyStart,
  count = 12,
  tempUnit = 'C',
  timeFormat = '12h',
  selectedHour,
  isDayFn,
}: {
  times: string[];
  temperatures: number[];
  apparentTemps?: number[];
  precipProbabilities?: number[];
  weatherCodes?: number[];
  hourlyStart: number;
  count?: number;
  tempUnit?: 'C' | 'F';
  timeFormat?: '12h' | '24h';
  selectedHour?: number;
  isDayFn?: (time: string) => boolean;
}): HourlyChartPoint[] {
  if (!times || times.length === 0) return [];
  const points: HourlyChartPoint[] = [];

  const safeStart = Math.max(0, Math.min(hourlyStart, times.length - 1));
  const end = Math.min(safeStart + count, times.length);

  for (let idx = safeStart; idx < end; idx++) {
    const rawTime = times[idx];
    const sliceIndex = idx - safeStart;
    const rawTemp = temperatures[idx] ?? 0;
    const convertedTemp = Math.round(convertTemperature(rawTemp, tempUnit));

    const rawApparent = apparentTemps?.[idx];
    const convertedApparent =
      rawApparent != null
        ? Math.round(convertTemperature(rawApparent, tempUnit))
        : undefined;

    const pop = precipProbabilities?.[idx] ?? 0;
    const weatherCode = weatherCodes?.[idx] ?? 0;
    const isDay = isDayFn ? isDayFn(rawTime) : true;
    const timeLabel = formatHourlyTimeLabel(rawTime, sliceIndex, timeFormat);

    points.push({
      index: idx,
      time: rawTime,
      timeLabel,
      temperature: convertedTemp,
      apparentTemp: convertedApparent,
      pop,
      weatherCode,
      isDay,
      isSelected: idx === selectedHour,
    });
  }

  return points;
}

export function calculateTemperatureStats(points: HourlyChartPoint[]): TemperatureStats {
  if (points.length === 0) {
    return {
      minTemp: 0,
      maxTemp: 0,
      range: 0,
      avgTemp: 0,
      trend: 'steady',
      netChange: 0,
      peakLabel: '--',
      troughLabel: '--',
    };
  }

  let minTemp = points[0].temperature;
  let maxTemp = points[0].temperature;
  let peakLabel = points[0].timeLabel;
  let troughLabel = points[0].timeLabel;
  let total = 0;

  for (const pt of points) {
    total += pt.temperature;
    if (pt.temperature < minTemp) {
      minTemp = pt.temperature;
      troughLabel = pt.timeLabel;
    }
    if (pt.temperature > maxTemp) {
      maxTemp = pt.temperature;
      peakLabel = pt.timeLabel;
    }
  }

  const avgTemp = Math.round(total / points.length);
  const netChange = points[points.length - 1].temperature - points[0].temperature;
  const range = maxTemp - minTemp;

  let trend: 'warming' | 'cooling' | 'steady' = 'steady';
  if (netChange >= 2) trend = 'warming';
  else if (netChange <= -2) trend = 'cooling';

  return {
    minTemp,
    maxTemp,
    range,
    avgTemp,
    trend,
    netChange,
    peakLabel,
    troughLabel,
  };
}
