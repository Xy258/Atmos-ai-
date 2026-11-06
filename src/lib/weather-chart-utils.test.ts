import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertTemperature,
  formatHourlyTimeLabel,
  buildHourlyChartData,
  calculateTemperatureStats,
} from './weather-chart-utils';

test('convertTemperature converts Celsius to Fahrenheit accurately', () => {
  assert.equal(convertTemperature(0, 'C'), 0);
  assert.equal(convertTemperature(0, 'F'), 32);
  assert.equal(convertTemperature(100, 'F'), 212);
  assert.equal(convertTemperature(20, 'C'), 20);
  assert.equal(Math.round(convertTemperature(20, 'F')), 68);
});

test('formatHourlyTimeLabel formats hour 0 as "Now" and subsequent hours as 12h/24h', () => {
  assert.equal(formatHourlyTimeLabel('2026-11-04T14:00', 0, '12h'), 'Now');
  assert.equal(formatHourlyTimeLabel('2026-11-04T14:00', 1, '12h'), '2 PM');
  assert.equal(formatHourlyTimeLabel('2026-11-04T09:00', 2, '12h'), '9 AM');
  assert.equal(formatHourlyTimeLabel('2026-11-04T14:00', 1, '24h'), '14:00');
});

test('buildHourlyChartData slices 12 hours and transforms values', () => {
  const times = Array.from({ length: 24 }, (_, i) => `2026-11-04T${String(i).padStart(2, '0')}:00`);
  const temperatures = Array.from({ length: 24 }, (_, i) => 20 + i);
  const precipProbabilities = Array.from({ length: 24 }, () => 10);
  const weatherCodes = Array.from({ length: 24 }, () => 0);

  const data = buildHourlyChartData({
    times,
    temperatures,
    precipProbabilities,
    weatherCodes,
    hourlyStart: 8,
    count: 12,
    tempUnit: 'C',
    timeFormat: '12h',
    selectedHour: 9,
  });

  assert.equal(data.length, 12);
  assert.equal(data[0].index, 8);
  assert.equal(data[0].timeLabel, 'Now');
  assert.equal(data[0].temperature, 28);
  assert.equal(data[0].isSelected, false);
  assert.equal(data[1].isSelected, true);
  assert.equal(data[11].index, 19);
});

test('calculateTemperatureStats returns min, max, average, and trend', () => {
  const samplePoints = [
    { index: 0, time: 'T00', timeLabel: 'Now', temperature: 18, pop: 0, weatherCode: 0, isDay: true },
    { index: 1, time: 'T01', timeLabel: '1 PM', temperature: 21, pop: 10, weatherCode: 1, isDay: true },
    { index: 2, time: 'T02', timeLabel: '2 PM', temperature: 25, pop: 20, weatherCode: 2, isDay: true },
    { index: 3, time: 'T03', timeLabel: '3 PM', temperature: 22, pop: 0, weatherCode: 0, isDay: true },
  ];

  const stats = calculateTemperatureStats(samplePoints);
  assert.equal(stats.minTemp, 18);
  assert.equal(stats.maxTemp, 25);
  assert.equal(stats.range, 7);
  assert.equal(stats.trend, 'warming');
  assert.equal(stats.troughLabel, 'Now');
  assert.equal(stats.peakLabel, '2 PM');
});
